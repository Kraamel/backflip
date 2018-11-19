Selectize.define( 'has_item', function( options ) {
    var self = this;

    this.hasItem = ( function(value) {

        return function(value) {
          for (var i = 0; i < self.items.length; i++) {
            if (self.items[i] === value) return true;
          }
          return false;
      };
    } )();
} );

Selectize.define( 'keep_placeholder', function( options ) {
    var self = this;

    this.updatePlaceholder = ( function() {

        return function() {
          var $input = self.$control_input;
          if (this.settings.placeholder) $input.attr('placeholder', this.settings.placeholder);
          $input.triggerHandler('update', {force: true});
      };
    } )();
} );

Selectize.define( 'soft_clear_options', function( options ) {
    this.softClearOptions = ( function() {
        return function() {
          for (var value in this.options) {
            if (!this.hasItem(value)) this.removeOption(value, true);
          }
        };
    } )();
} );

Selectize.define('create_on_enter', function () {
    if (this.settings.mode !== 'multi')
        return;
    var self = this;
    this.onKeyUp = (function (e) {
        var original = self.onKeyUp;
        return function (e) {
            if (e.keyCode === 13 && this.$control_input.val().trim() !== '') {
                self.createItem(this.$control_input.val());
            }
            return original.apply(this, arguments);
        };
    })();
});

var emptySpeed = 200;
var fillSpeed = 100;

$.fn.emptyFaded = function() {
  this.children().each(function() {
    $(this).fadeOut(emptySpeed, 'linear', function() {
      $(this).remove();
    });
  });
};

$.fn.fillFaded = function($new) {
  var container = this;
  $new.children().each(function(index) {
    var that = this;
    setTimeout(function() {
      container.append($(that));
      setTimeout(function() {
        $(that).addClass('show');
      }, index*fillSpeed);
    }, emptySpeed+fillSpeed);
  });
};

$(document).ready(function () {

  var ALGOLIA_APPID = 'RSXBUBL0PB';
  var ALGOLIA_SEARCH_APIKEY = algoliaPublicKey.value;
  var algolia = algoliasearch(ALGOLIA_APPID, ALGOLIA_SEARCH_APIKEY);
  var world = algolia.initIndex('world');

  searchForHashtags();

  // DOM and Templates binding
  var $searchInput = $('#search input');
  var $hashtags = $('#wings-suggestions');
  var $modalLayer = $('#modal-layer');
  var hashtagsTemplate = Hogan.compile($('#hashtags-template').text());

  // Hashtags Bank
  var hashtagsBank = {};
  addHashtagsToBank(hashtagsForBank);

  // proposed wings if they exist
  var proposedWings = (new URLSearchParams(window.location.search)).get('proposedWings');
  if(proposedWings) proposedWings = proposedWings.split(',');

  // Selectize
  var selectizeHashtags = '';
  var $selectize = $searchInput.selectize({
    valueField: 'tag',
    labelField: 'tag',
    loadThrottle: null,
    maxOptions: 5,
    highlight: false,
    plugins: ['drag_drop', 'remove_button', 'soft_clear_options', 'has_item', 'create_on_enter', 'keep_placeholder'],
    persist: false,
    create: function(input) {
      return getHashtag(input);
    },
    openOnFocus: false,
    createOnBlur: true,
    closeAfterSelect: true,
    hideSelected: true,
    load: function(query, callback) {
        world.search({
          query: query,
          attributesToRetrieve: ['type','name', 'tag','picture'],
          facetFilters: ['type:hashtag'],
          hitsPerPage: 5
        },
        function(err, content) {
          if (err) {
            console.error(err);
          }
          if (content.hits && content.hits.length) {
            addHashtagsToBank(content.hits);
            this.softClearOptions();
          }
          callback(content.hits);
        }.bind(this));
    },
    render: {
        option: function(option) {
            var highlightedName = option._highlightResult ? (option._highlightResult.name.value || option._highlightResult.tag.value) : option.tag;
            var highlightedTag = option._highlightResult ? option._highlightResult.tag.value : option.tag;
            return '<div class="aa-suggestion ' + option.type + '">' +
            '<span class="tag">' +
            highlightedTag +
            '</span>' +
            getPictureHtml(option, true) +
            '<span>' +
            highlightedName +
            '</span>' +
            '</div>';
        },
        item: function(item, escape) {
            return hashtagsTemplate.render(getHashtag(item));
        },
        option_create: function(data) {
          if (data.input.charAt(0) !== '#') data.input = '#' + data.input;
          return '<div class="create aa-suggestion hashtag" data-selectable="">' +
          '<span class="tag"><em>' +
          data.input +
          '</em></span>' +
          '<span>' +
          newHashtagSentence +
          '</span>' +
          '</div>';
        }
    },
    score: function() {
      return function() {
        return 1;
      };
    },
    onChange: function (value) {
      search();
    },
    onDropdownOpen: function($dropdown) {
      $modalLayer.addClass('show');
    },
    onDropdownClose: function($dropdown) {
      $modalLayer.removeClass('show');
    }
  })[0].selectize;

  // Initial search
  search();

  // SEARCH ALL
  // ==========
  var query, facetFilters, page;

  function search() {
    page = 0;
    query = $selectize.$control_input.val();
    facetFilters = ['type:person'];
    if($selectize.items.length)
      facetFilters.push('hashtags.tag:' + $selectize.items[$selectize.items.length-1]);
    searchForSuggestions();
  }

  function searchForSuggestions() {
    $hashtags.emptyFaded();
    world.searchForFacetValues({
      facetName: 'hashtags.tag',
      facetQuery: '',
      query: query,
      facetFilters: facetFilters
    }, function(err, content) {
      if (err) throw new Error(err);
      renderSuggestions(content.facetHits);
    });
  }

  function searchForHashtags() {
    world.search({
      facetFilters: ['type:hashtag'],
      attributesToRetrieve: ['type','name', 'tag','picture'],
      hitsPerPage: 100
    }, function(err, content) {
      if (err) throw new Error(err);
      addHashtagsToBank(content.hits);
    });
  }

  // RENDER SUGGESTIONS
  // =========================
  function renderSuggestions(hits) {
    var notEnough = 12;
    var suggestedTags = [];
    var $newHashtags = $('<div></div>');
    for (var i = 0; i < hits.length; ++i) {
      var hit = hits[i];
      if ($.inArray(hit.value, $selectize.items) === -1 && hit.count > 1 && (i < 2 || getRandomInt(3) === 0 )) {
        $newHashtags.append(hashtagsTemplate.render(getHashtag(hit.value)));
        suggestedTags.push(hit.value);
        notEnough--;
      }
    }
    for (var prop in hashtagsBank) {
      if (notEnough > 0 && getRandomInt(3) === 0 && $.inArray(prop, $selectize.items) === -1 && $.inArray(prop, suggestedTags) === -1) {
        $newHashtags.append(hashtagsTemplate.render(getHashtag(prop)));
        suggestedTags.push(prop);
        notEnough--;
      }
    }
    $hashtags.fillFaded($newHashtags);
  }

  function addHashtagsToBank(hits) {
    hits.forEach(function(hit) {
      hashtagsBank[hit.tag] = {
        tag: hit.tag,
        type: hit.type,
        name: hit.name,
        picture: hit.picture
      };
    });
  }

  function isProposedWings(hashtag) {
    if(proposedWings)
      return proposedWings.includes(hashtag.tag.replace('#', ''))
    return false;
  }

  function getHashtag(hashtag) {
    if (typeof hashtag === "string") {
      if(hashtag.charAt(0) !== '#') hashtag = '#' + hashtag;
      hashtag = {tag: hashtag};
    }
    if (hashtagsBank[hashtag.tag]) {
      hashtag = hashtagsBank[hashtag.tag];
    }
    if(isProposedWings(hashtag)){
      hashtag.proposedClass = 'proposedWings';
    } 
    if (!hashtag.type) hashtag.type = 'hashtag';
    if (!hashtag.name) hashtag.name = hashtag.tag.replace('#','');
    hashtag.pictureHtml = getPictureHtml(hashtag, true);
    hashtag.$score = 1;
    return hashtag;
  }

  // EVENTS BINDING
  // ==============
  $hashtags.on('click', '.hashtag', function (e) {
    e.preventDefault();
    $selectize.addOption({
      tag: $(this).data('tag'),
      name: $(this).data('name'),
      picture: {
        emoji: $(this).data('picture-emoji'),
        path: $(this).data('picture-path')
      },
      type: 'hashtag'
    });
    $selectize.addItem($(this).data('tag'), false);
  });
  $('.reload').on('click', function(e) {
    searchForSuggestions();
  });
  $selectize.$control_input.keydown(function(event){
    if(event.keyCode == 13) {
      event.preventDefault();
      return false;
    }
  });

});
