/**
* @Author: Clément Dietschy <bedhed>
* @Date:   10-12-2016
* @Email:  clement@lenom.io
* @Project: Lenom - Backflip
* @Last modified by:   clement
* @Last modified time: 06-04-2017 01:48
* @Copyright: Clément Dietschy 2017
*/

/*
/ @todo infinit scroll https://www.algolia.com/doc/guides/search/infinite-scroll
*/

// The length of the Description Snippet depends on the screen width.
// @todo make it responsive dynamically (or not?)
var descriptionSnippetLength = 8;
var extraLinkLimit = 4;
if (window.matchMedia('(min-width: 64em)').matches) {
		descriptionSnippetLength = 48;
		extraLinkLimit = 7;
} else if (window.matchMedia('(min-width: 48em)').matches) {
		descriptionSnippetLength = 20;
		extraLinkLimit = 6;
} else if (window.matchMedia('(min-width: 35.5em)').matches) {
		descriptionSnippetLength = 14;
		extraLinkLimit = 5;
}

var search = instantsearch({
	appId: 'RSXBUBL0PB',
	apiKey: algoliaPublicKey.value,
	indexName: 'world',
	urlSync: true,
	searchParameters: {
		attributesToSnippet: [
    	"description:"+descriptionSnippetLength
  	]
	}
});

transformItem = function (item) {
	transformImagePath(item);
	transformDescriptions(item);
	transformLinks(item);
	return item;
};

function transformImagePath(item) {
	if (!item.picture) {
		item.picture = {
			url: "/images/placeholder.png"
		};
		item.type += " invisible";
	} else if (item.picture.path) {
		item.picture.url = "/images" + item.picture.path;
		//@todo remove this last if once the refacto URI > URL is done
	} else if (item.picture.uri) {
		item.picture.url = item.picture.uri;
	}
}

function transformDescriptions(item) {
	if (item._snippetResult) item._snippetResult.description.value = transformString(item._snippetResult.description.value);
	if (item._highlightResult) item._highlightResult.description.value = transformString(item._highlightResult.description.value);
}

function transformString(input) {
		var regex = /([@#][\w-<>\/]+)/g;
		return input.replace(regex, function(match, offset, string) {
			var cleanMatch = match.replace(/<\/?em>/g, '');
			return `<a onclick="setSearch('${cleanMatch}')">${match}</a>`;
		});
}

function transformLinks(item) {
	item.links.forEach(function (link, index, array) {
		makeLinkIcon(link);
		makeLinkDisplay(link);
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
		default:
			link.icon = link.type;
			break;
	}
}

function makeLinkDisplay(link) {
	link.display = link.display || link.value;
}

function makeLinkUrl(link) {
	if (!link.url) {
		switch (link.type) {
			case 'email':
				link.url = 'mailto:'+link.value;
				break;
			case 'address':
				link.url = 'http://maps.google.com/?q='+encodeURIComponent(link.value);
				break;
			default:
				link.url = link.uri;
				break;
		}
	}
}

search.addWidget(
	instantsearch.widgets.searchBox({
		container: '#search-box',
		placeholder: '#Friendly Coworker Search',
		wrapInput: false,
		autofocus: false,
		cssClasses: {
			input: 'search-input'
		}
    })
);

search.addWidget(
  instantsearch.widgets.infiniteHits({
    container: '#search-results',
    hitsPerPage: 50,
    templates: {
      item: getTemplate('hit'),
      empty: getTemplate('noone')
    },
    transformData: transformItem
  })
);

search.addWidget(
  instantsearch.widgets.refinementList({
    container: '#within',
    attributeName: 'within.tag',
    operator: 'and',
    limit: 10,
		searchForFacetValues: {
			placeholder: 'Search',
		},
		templates: {
      header: 'Teams & Hashtags'
    }
  })
);

search.addWidget(
  instantsearch.widgets.refinementList({
    container: '#types',
    attributeName: 'type',
    operator: 'or',
    limit: 10,
		templates: {
      header: 'Showing'
    }
  })
);

search.addWidget(
  instantsearch.widgets.clearAll({
    container: '#clear-all',
    templates: {
      link: 'Reset Search'
    }
  })
);



function findAncestor(child, classSearched) {
    while ((child = child.parentElement) && !child.classList.contains(classSearched));
		return child;
}

function toggleItem(child) {
	findAncestor(child, 'item').classList.toggle('expanded');
}

function togglePanel() {
	document.getElementById('left-panel').classList.toggle('open');
}

function setSearch(query) {
	search.helper.setQuery(query).search();
	window.scrollTo(0,0);
}

function getTemplate(templateName) {
  return document.getElementById(templateName + '-template').innerHTML;
}
function refresh() {
  window.location.reload(true);
}

search.start();

// We force refresh every 6 hours to get new api key & get updates
window.setTimeout(refresh , 21600000);
