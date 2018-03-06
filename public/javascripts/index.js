/* jshint esversion: 5 */

/*
/ @todo infinit scroll https://www.algolia.com/doc/guides/search/infinite-scroll
/ @todo rename and split file
/ @todo rename item into record
*/

// The length of the Description Snippet depends on the screen width.
// @todo make it responsive dynamically (or not?)
var introSnippetLength = 6;
var extraLinkLimit = 4;
if (window.matchMedia('(min-width: 720px)').matches) {
		introSnippetLength = 15;
		extraLinkLimit = 9;
}

var search = instantsearch({
	appId: 'RSXBUBL0PB',
	apiKey: algoliaPublicKey.value,
	indexName: 'world',
	urlSync: true,
	searchParameters: {
		attributesToSnippet: [
    	"description:"+introSnippetLength,
	    "intro:"+introSnippetLength
  	],
		disjunctiveFacetsRefinements: {
			type: ['person']
		}
	}
});

transformItem = function (item) {
	transformImagePath(item);
	transformIntro(item);
	transformLinks(item);
	transformHashtags(item);
	addType(item);
	addUrl(item);
	addParentTag(item);
	return item;
};

function addParentTag(item) {
	if (item.type == 'team') item.parentTag = item.tag;
	else if (item.within) {
		var parent = item.within.find(function(within) {
			return within.type=='team' && within.tag != item.tag;
		});
		if (parent) item.parentTag = parent.tag;
	}
}

function transformImagePath(item) {
	item.picture = {url: getPictureUrl(item)};
}

//@todo handle the display of teams
function transformIncludes(item) {
	if (!item.includes || !item.includes.length || !item.includes_count) return;
	item.mozaic = true;
	if (item.includes_count.person > 8) {
		item.mozaic_more = item.includes_count.person + item.includes_count.team + item.includes_count.hashtag - 7;
		item.includes = item.includes.slice(0,7);
	}
	item.includes.forEach(function(item) {
		 transformImagePath(item);
	});
}

function transformIntro(item) {
	if (item._snippetResult && item._snippetResult.intro) item._snippetResult.intro.value = transformString(item._snippetResult.intro.value, item.within);
	else if (item._snippetResult && item._snippetResult.description) item._snippetResult.intro = {value: transformString(item._snippetResult.description.value, item.within)};
}

function transformString(input, within) {
		// Does not match person (@) yet
		var regex = /([#][^\s@#\,\.\!\?\;\(\)]+)/g;
		input = input.replace(regex, function(match, offset, string) {
			var cleanMatch = match.replace(/<\/?em>/g, '');
			record = getRecord(cleanMatch, within);
			return '<a title="' + record.name + '" class="link-' + record.type + '" onclick="setSearch(\'' + ( record.type == 'team' ? '' : cleanMatch ) + '\', \'' + ( record.type == 'team' ? cleanMatch : '' ) + '\')">' + match + '</a>';
		});
		return input;
}

function getRecord(tag, within) {
	record = within.find(function (record) { return record.tag == tag; });
	if (!record) return {tag: tag, name: tag, type: 'hashtag'};
	return record;
}

function getTitle(tag, within) {
		if (!within) return tag;
		record = within.find(function(record) { return record.tag == tag; });
		if (!record) return tag;
		return record.name;
}

// @todo find somewhere to put & deduplicate the transformLinks (public/js/index.js + views/hbs.js) logic.
function transformLinks(item) {
	item.links = item.links || [];
	item.links.forEach(function (link, index, array) {
		makeLinkDisplay(link);
		makeLinkIcon(link);
		makeLinkUrl(link);
		if (index > extraLinkLimit-1) link.class = 'extraLink';
	});
}

function makeLinkIcon(link) {
	switch (link.type) {
		case 'email':
			link.icon = 'envelope-o';
			break;
		case 'address':
			link.icon = 'map-marker';
			break;
		case 'hyperlink':
			link.icon = 'link';
			break;
		default:
			link.icon = link.type;
			break;
	}
}

function makeLinkDisplay(link) {
	link.display = link.display || link.value;
}

function makeLinkUrl(link) {
	link.url = link.url || link.uri;
	if (!link.url) {
		switch (link.type) {
			case 'email':
				link.url = 'mailto:'+link.value;
				break;
			case 'phone':
				link.url = 'tel:'+link.value;
				break;
			case 'home':
				link.url = 'tel:'+link.value;
				break;
			case 'address':
				link.url = 'http://maps.google.com/?q='+encodeURIComponent(link.value);
				break;
			default:
				link.url = link.value;
				break;
		}
	}
}

function addType(item) {
	item[item.type] = true;
}

function addUrl(item) {
	item.url = makeUrl(null, item.tag);
}

transformTypeItem = function(item) {
	var icon = 'fa-at';
	switch (item.name) {
		case 'person': icon = 'fa-user-circle-o'; break;
		case 'hashtag': icon = 'fa-hashtag'; break;
	}
	item.highlighted = '<i class="fa ' + icon + '" aria-hidden="true"></i><span class="toggle-text">' + typeStrings[item.name] + '</span>';
	return item;
};

transformHashtags = function(item) {
	if (!item.hashtags) item.hashtags = [];
	if (!item.within) item.within = [];
	item.hashtags = item.hashtags.concat(item.within);
	item.hashtags.forEach(function(item) {
		 transformImagePath(item);
	});
};

search.addWidget(
	instantsearch.widgets.searchBox({
		container: '#search',
		placeholder: searchPlaceholder,
		wrapInput: false,
		autofocus: false,
    reset: false,
		magnifier: false,
    loadingIndicator: false,
		cssClasses: {
			input: 'search-input'
		}
    })
);

search.addWidget(
  instantsearch.widgets.infiniteHits({
    container: '#search-results',
    hitsPerPage: 30,
		cssClasses: {
			item: 'pure-g-box'
		},
    templates: {
      item: getTemplate('hit'),
      empty: getTemplate('noone')
    },
    transformData: transformItem,
		showMoreLabel: hitsShowMore
  })
);

search.addWidget(
  instantsearch.widgets.refinementList({
    container: '#types',
    attributeName: 'type',
    operator: 'or',
    limit: 4,
		transformData: transformTypeItem
  })
);

search.addWidget(
  instantsearch.widgets.analytics({
    pushFunction: function(formattedParameters, state, results) {
      window.ga('set', 'page', '/search/query/?query=' + state.query + '&' + formattedParameters + '&numberOfHits=' + results.nbHits);
      window.ga('send', 'pageView');
		}
	})
);

function setSearch(query, parent, filter) {
	if (query == parent) query = '';
	search.helper.clearRefinements().setQuery(query);

	if (filter) search.helper.toggleRefinement('type', filter);

	if (parent) setHierarchicalRefinement(query, parent);

	search.helper.search();
	window.scrollTo(0,0);
}

function setHierarchicalRefinement(query, parent) {
	var branch = orgTree.find(function(branch) { return branch[branch.length-1] == parent; });
	if (branch) search.helper.toggleRefinement('structure.0', branchToString(branch));
	search.helper.setQuery(parent + ' ' + query);
}

function branchToString(branch) {
	return branch.reduce(function(acc, tag, index, branch) {
		if (index === branch.length-1) return acc + tag;
		return acc + tag + ' > ';
	}, '');
}

function refresh() {
  window.location.reload(true);
}

search.start();

// We force refresh every 1 hour to get new api key & get updates
window.setTimeout(refresh , 3600000);
