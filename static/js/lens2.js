(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Little helper used to parse query strings from urls
// --------
//
window.Lens = require("./src/ubhd-lens");

/*

var documentURL = "data/example.xml";
if (qs !== undefined) {


    var qs = function () {
        var query_string = {};
        var query = window.location.search.substring(1);
        var vars = query.split("&");
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            // If first entry with this name
            if (typeof query_string[pair[0]] === "undefined") {
                query_string[pair[0]] = pair[1];
                // If second entry with this name
            } else if (typeof query_string[pair[0]] === "string") {
                var arr = [query_string[pair[0]], pair[1]];
                query_string[pair[0]] = arr;
                // If third or later entry with this name
            } else {
                query_string[pair[0]].push(pair[1]);
            }
        }
        return query_string;
    }();

    if (qs.url !== undefined) {
        if (qs.url.endsWith('/')) {
            qs.url.slice(0, -1);
        }
        documentURL = decodeURIComponent(qs.url);
    }
}
$(function () {

    var app = new window.Lens({
        document_url: documentURL

    });

    app.start();

    window.app = app;

});*/

},{"./src/ubhd-lens":201}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var util = require("../substance/util");
var Document = require("../substance/document");

// Lens.Article
// -----------------

var Article = function(options) {
  options = Article.prepareOptions(options);

  Document.call(this, options);

  // Index for easy mapping from NLM sourceIds to generated nodeIds
  // Needed for resolving figrefs / citationrefs etc.
  this.bySourceId = this.addIndex("by_source_id", {
    property: "source_id"
  });

  this.nodeTypes = options.nodeTypes;

  // Seed the doc
  // --------

  if (options.seed === undefined) {
    this.create({
      id: "document",
      type: "document",
      guid: options.id, // external global document id
      creator: options.creator,
      created_at: options.created_at,
      views: Article.views, // is views really needed on the instance level
      title: "",
      abstract: "",
      authors: []
    });

    // Create views on the doc
    _.each(Article.views, function(view) {
      this.create({
        id: view,
        "type": "view",
        nodes: []
      });
    }, this);
  }
};

Article.Prototype = function() {

  this.fromSnapshot = function(data, options) {
    return Article.fromSnapshot(data, options);
  };

  // For a given NLM source id, returns the corresponding node in the document graph
  // --------

  this.getNodeBySourceId = function(sourceId) {
    var nodes = this.bySourceId.get(sourceId);
    var nodeId = Object.keys(nodes)[0];
    var node = nodes[nodeId];
    return node;
  };

  // Get all headings of the content view
  // --------

  this.getHeadings = function() {
    var headings = _.filter(this.get('content').getNodes(), function(node) {
      return node.type === "heading";
    });
    return headings;
  };

  this.getTocNodes = function() {
    var nodes = _.filter(this.get('content').getNodes(), function(node) {
      return node.includeInToc();
    });
    return nodes;
  };

};

Article.prepareOptions = function(options) {
  // prepare configuration for
  options = options || {};
  options.nodeTypes = _.extend(Article.nodeTypes, options.nodeTypes);
  options.schema = Article.getSchema(options.nodeTypes);
  return options;
};

Article.getSchema = function(nodeTypes) {
  var schema = util.deepclone(Document.schema);
  schema.id = "lens-article";
  schema.version = "2.0.0";
  _.each(nodeTypes, function(nodeSpec, key) {
    schema.types[key] = nodeSpec.Model.type;
  });
  return schema;
};

// Factory method
// --------
//
// TODO: Ensure the snapshot doesn't get chronicled

Article.fromSnapshot = function(data, options) {
  options = options || {};
  options.seed = data;
  return new Article(options);
};


// Define available views
// --------

Article.views = ["content", "figures", "footnotes","citations", "definitions", "info"];
// Register node types
// --------

Article.nodeTypes = require("./nodes");

Article.ViewFactory = require('./view_factory');

// HACK: ResourceView is only used as a mixin for resource view implementations
// There is no specific model for it, thus can not be registered in nodeTypes
Article.ResourceView = require('./resource_view');

// From article definitions generate a nice reference document
// --------
//

var ARTICLE_DOC_SEED = {
  "id": "lens_article",
  "nodes": {
    "document": {
      "type": "document",
      "id": "document",
      "views": [
        "content"
      ],
      "title": "The Anatomy of a Lens Article",
      "authors": ["contributor_1", "contributor_2", "contributor_3"],
      "guid": "lens_article"
    },


    "content": {
      "type": "view",
      "id": "content",
      "nodes": [
        "cover",
      ]
    },

    "cover": {
      "id": "cover",
      "type": "cover"
    },

    "contributor_1": {
      "id": "contributor_1",
      "type": "contributor",
      "name": "Michael Aufreiter"
    },

    "contributor_2": {
      "id": "contributor_2",
      "type": "contributor",
      "name": "Ivan Grubisic"
    },

    "contributor_3": {
      "id": "contributor_3",
      "type": "contributor",
      "name": "Rebecca Close"
    }
  }
};

Article.describe = function() {
  var doc = new Article({seed: ARTICLE_DOC_SEED});

  var id = 0;

  _.each(Article.nodeTypes, function(nodeType) {
    nodeType = nodeType.Model;

    // Create a heading for each node type
    var headingId = "heading_"+nodeType.type.id;

    doc.create({
      id: headingId,
      type: "heading",
      content: nodeType.description.name,
      level: 1
    });

    // Turn remarks and description into an introduction paragraph
    var introText = nodeType.description.remarks.join(' ');
    var introId = "text_"+nodeType.type.id+"_intro";

    doc.create({
      id: introId,
      type: "text",
      content: introText,
    });


    // Show it in the content view
    doc.show("content", [headingId, introId], -1);

    // Include property description
    // --------
    //

    doc.create({
      id: headingId+"_properties",
      type: "text",
      content: nodeType.description.name+ " uses the following properties:"
    });

    doc.show("content", [headingId+"_properties"], -1);

    var items = [];

    _.each(nodeType.description.properties, function(propertyDescr, key) {

      var listItemId = "text_" + (++id);
      doc.create({
        id: listItemId,
        type: "text",
        content: key +": " + propertyDescr
      });

      // Create code annotation for the propertyName
      doc.create({
        "id": id+"_annotation",
        "type": "code",
        "path": [listItemId, "content"],
        "range":[0, key.length]
      });

      items.push(listItemId);
    });

    // Create list
    doc.create({
      id: headingId+"_property_list",
      type: "list",
      items: items,
      ordered: false
    });

    // And show it
    doc.show("content", [headingId+"_property_list"], -1);

    // Include example
    // --------
    //

    doc.create({
      id: headingId+"_example",
      type: "text",
      content: "Here's an example:"
    });

    doc.create({
      id: headingId+"_example_codeblock",
      type: "codeblock",
      content: JSON.stringify(nodeType.example, null, '  '),
    });

    doc.show("content", [headingId+"_example", headingId+"_example_codeblock"], -1);
  });

  return doc;
};


Article.Prototype.prototype = Document.prototype;
Article.prototype = new Article.Prototype();
Article.prototype.constructor = Article;


// Add convenience accessors for builtin document attributes
Object.defineProperties(Article.prototype, {
  id: {
    get: function () {
      return this.get("document").guid;
    },
    set: function(id) {
      this.get("document").guid = id;
    }
  },
  creator: {
    get: function () {
      return this.get("document").creator;
    },
    set: function(creator) {
      this.get("document").creator = creator;
    }
  },
  created_at: {
    get: function () {
      return this.get("document").created_at;
    },
    set: function(created_at) {
      this.get("document").created_at = created_at;
    }
  },
  title: {
    get: function () {

      return this.get("document").title;
    },
    set: function(title) {
      this.get("document").title = title;
    }
  },
  abstract: {
    get: function () {
      return this.get("document").abstract;
    },
    set: function(abstract) {
      this.get("document").abstract = abstract;
    }
  },
  on_behalf_of: {
    get: function () {
      return this.get("document").on_behalf_of;
    },
    set: function(on_behalf_of) {
      this.get("document").on_behalf_of = on_behalf_of;
    }
  },
  authors: {
    get: function () {
      var docNode = this.get("document");
      if (docNode.authors) {
        return _.map(docNode.authors, function(contributorId) {
          return this.get(contributorId);
        }, this);
      } else {
        return "";
      }
    },
    set: function(val) {
      var docNode = this.get("document");
      docNode.authors = _.clone(val);
    }
  },
  views: {
    get: function () {
      // Note: returing a copy to avoid inadvertent changes
      return this.get("document").views.slice(0);
    }
  },
});
module.exports = Article;

},{"../substance/document":186,"../substance/util":195,"./nodes":82,"./resource_view":140,"./view_factory":141,"underscore":198}],4:[function(require,module,exports){
var MONTH_MAPPING = {
  "1": "January",
  "2": "February",
  "3": "March",
  "4": "April",
  "5": "May",
  "6": "June",
  "7": "July",
  "8": "August",
  "9": "September",
  "10": "October",
  "11": "November",
  "12": "December"
};
var WEEKDAY_MAPPING = {
    "0" : "Sunday",
    "1" : "Monday",
    "2" : "Tuesday",
    "3" : "Wednesday",
    "4" : "Thursday",
    "5" : "Friday",
    "6" : "Saturday"
};
var util = {};

util.formatDate = function (pubDate) {
  var parts = pubDate.split("-");
  if (parts.length >= 3) {
    // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
    // Note: months are 0-based
    var localDate = new Date(parts[0], parts[1]-1, parts[2]);
    return localDate.toUTCString().slice(5, 16);
  } else if (parts.length === 2) {
    var month = parts[1].replace(/^0/, "");
    var year = parts[0];
    return MONTH_MAPPING[month]+" "+year;
  } else {
    return year;
  }
};

module.exports = util;

},{}],5:[function(require,module,exports){
"use strict";

var Article = require("./article");

module.exports = Article;
},{"./article":3}],6:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');

var Affiliation = function(node, doc) {
  Document.Node.call(this, node, doc);
};

Affiliation.type = {
  "id": "affiliation",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "city": "string",
    "country": "string",
    "department": "string",
    "institution": "string",
    "label": "string",
    "specific_use": "string"
  }
};


Affiliation.description = {
  "name": "Affiliation",
  "description": "Person affiliation",
  "remarks": [
    "Name of a institution or organization, such as a university or corporation, that is the affiliation for a contributor such as an author or an editor."
  ],
  "properties": {
    "institution": "Name of institution",
    "department": "Department name",
    "country": "Country where institution is located",
    "city": "City of institution",
    "label": "Affilation label. Usually a number counting up"
  }
};


Affiliation.example = {
  "id": "affiliation_1",
  "source_id": "aff1",
  "city": "Jena",
  "country": "Germany",
  "department": "Department of Molecular Ecology",
  "institution": "Max Planck Institute for Chemical Ecology",
  "label": "1",
  "type": "affiliation"
};

Affiliation.Prototype = function() {};

Affiliation.Prototype.prototype = Document.Node.prototype;
Affiliation.prototype = new Affiliation.Prototype();
Affiliation.prototype.constructor = Affiliation;

Document.Node.defineProperties(Affiliation);

module.exports = Affiliation;

},{"../../../substance/document":186}],7:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./affiliation')
};

},{"./affiliation":6}],8:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');
var Composite = Document.Composite;

// Lens.Box
// -----------------
//

var Abstract = function(node, doc) {
    Composite.call(this, node, doc);
};

// Type definition
// -----------------
//

Abstract.type = {
    "id": "abstract",
    "parent": "content",
    "properties": {
        "title":"text",
        "children": ["array", "paragraph"]
    }


};

// This is used for the auto-generated docs
// -----------------
//

Abstract.description = {
    "name": "Abstract",
    "remarks": [
        "Abstract",
    ],
    "properties": {
        "children": {
            "abstract": "abstract element"
        }
    }
};


// Example Section Metadata
// -----------------
//

Abstract.example = {
    "id": "abstract_1",
    "type": "abstract",

    "children": {
        "abstract":"abstract_id"}
};

Abstract.Prototype = function() {

    this.getChildrenIds = function() {
        return this.properties.children;
    };

};

Abstract.Prototype.prototype = Composite.prototype;
Abstract.prototype = new Abstract.Prototype();
Abstract.prototype.constructor = Abstract;

Document.Node.defineProperties(Abstract);

module.exports = Abstract;

},{"../../../substance/document":186}],9:[function(require,module,exports){
"use strict";

var NodeView = require('../node').View;
var CompositeView = require("../composite").View;
var $$ = require("../../../substance/application").$$;

// Lens.abstract.View
// ==========================================================================

var abstractView = function (node, viewFactory) {
    CompositeView.call(this, node, viewFactory);
};

abstractView.Prototype = function () {

    this.render = function () {
        NodeView.prototype.render.call(this);
        this.content = document.createElement("div");

        var title = this.node.title;

        if (title != null || title !== undefined) {
            if (title.textContent === undefined & title.length == 0) {
                title = document.createElement("div");
                title.className = 'content';
                var title_text = document.createElement("div");
                title_text.className = 'content-node text';
                title.appendChild(title_text);
                this.content.appendChild(title);

            }
            else {
                if (title.length > 0) {
                    var childView = this.createChildView(title);
                    var childViewEl = childView.render().el;
                    childViewEl.className += ' title';
                    this.content.appendChild(childViewEl);
                }

            }
        }

        if (this.node.children.length > 0) {
            this.el.appendChild(this.content);
            this.renderChildren();
        }
        return this;
    };
};

abstractView.Prototype.prototype = CompositeView.prototype;
abstractView.prototype = new abstractView.Prototype();

module.exports = abstractView;


},{"../../../substance/application":173,"../composite":36,"../node":97}],10:[function(require,module,exports){

module.exports = {
    Model: require('./abstract'),
    View: require('./abstract_view')
};


},{"./abstract":8,"./abstract_view":9}],11:[function(require,module,exports){

var Document = require('../../../substance/document');

var Annotation = function(node, doc) {
  Document.Node.call(this, node, doc);
};

Annotation.type = {
  id: 'annotation',
  properties: {
    path: ["array", "string"], // -> e.g. ["text_1", "content"]
    range: ['array', 'number']
  }
};

Annotation.Prototype = function() {
  this.getLevel = function() {
    return this.constructor.fragmentation;
  };
};

Annotation.Prototype.prototype = Document.Node.prototype;
Annotation.prototype = new Annotation.Prototype();
Annotation.prototype.constructor = Annotation;

Annotation.NEVER = 1;
Annotation.OK = 2;
Annotation.DONT_CARE = 3;

// This is used to control fragmentation where annotations overlap.
Annotation.fragmentation = Annotation.DONT_CARE;

Document.Node.defineProperties(Annotation);

module.exports = Annotation;

},{"../../../substance/document":186}],12:[function(require,module,exports){
"use strict";

var AnnotationView = function(node, viewFactory) {
  this.node = node;
  this.viewFactory = viewFactory;
  this.el = this.createElement();
  this.el.dataset.id = node.id;
  this.$el = $(this.el);
  this.setClasses();
};

AnnotationView.Prototype = function() {

  this.createElement = function() {
    return document.createElement('span');
  };

  this.setClasses = function() {
    this.$el.addClass('annotation').addClass(this.node.type);
  };

  this.render = function() {
    return this;
  };

};
AnnotationView.prototype = new AnnotationView.Prototype();

module.exports = AnnotationView;

},{}],13:[function(require,module,exports){

module.exports = {
  Model: require('./annotation.js'),
  View: require('./annotation_view.js')
};

},{"./annotation.js":11,"./annotation_view.js":12}],14:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');

var AuthorCallout = function(node, doc) {
  Annotation.call(this, node, doc);
};

AuthorCallout.type = {
  id: "emphasis",
  parent: "annotation",
  properties: {
    "style": "string"
  }
};

AuthorCallout.Prototype = function() {};
AuthorCallout.Prototype.prototype = Annotation.prototype;
AuthorCallout.prototype = new AuthorCallout.Prototype();
AuthorCallout.prototype.constructor = AuthorCallout;

AuthorCallout.fragmentation = Annotation.DONT_CARE;

Document.Node.defineProperties(AuthorCallout);

module.exports = AuthorCallout;

},{"../../../substance/document":186,"../annotation/annotation":11}],15:[function(require,module,exports){
var AnnotationView = require('../annotation').View;

var AuthorCalloutView = function(node) {
  AnnotationView.call(this, node);
};

AuthorCalloutView.Prototype = function() {

  this.setClasses = function() {
    AnnotationView.prototype.setClasses.call(this);
    this.$el.addClass(this.node.style);
  };

};
AuthorCalloutView.Prototype.prototype = AnnotationView.prototype;
AuthorCalloutView.prototype = new AuthorCalloutView.Prototype();

module.exports = AuthorCalloutView;

},{"../annotation":13}],16:[function(require,module,exports){

module.exports = {
  Model: require('./author_callout.js'),
  View: require('./author_callout_view.js')
};

},{"./author_callout.js":14,"./author_callout_view.js":15}],17:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');
var Composite = Document.Composite;

// Lens.Box
// -----------------
//

var Box = function(node, doc) {
  Composite.call(this, node, doc);
};

// Type definition
// -----------------
//

Box.type = {
  "id": "box",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "label": "string",
    "children": ["array", "paragraph"]
  }
};

// This is used for the auto-generated docs
// -----------------
//

Box.description = {
  "name": "Box",
  "remarks": [
    "A box type.",
  ],
  "properties": {
    "label": "string",
    "children": "0..n Paragraph nodes",
  }
};


// Example Box
// -----------------
//

Box.example = {
  "id": "box_1",
  "type": "box",
  "label": "Box 1",
  "children": ["paragraph_1", "paragraph_2"]
};

Box.Prototype = function() {

  this.getChildrenIds = function() {
    return this.properties.children;
  };

};

Box.Prototype.prototype = Composite.prototype;
Box.prototype = new Box.Prototype();
Box.prototype.constructor = Box;

Document.Node.defineProperties(Box);

module.exports = Box;

},{"../../../substance/document":186}],18:[function(require,module,exports){
"use strict";

var NodeView = require('../node').View;
var CompositeView = require("../composite").View;
var $$ = require("../../../substance/application").$$;

// Lens.Box.View
// ==========================================================================

var BoxView = function(node, viewFactory) {
  CompositeView.call(this, node, viewFactory);
};

BoxView.Prototype = function() {

  // Render it
  // --------
  //

  this.render = function() {
    NodeView.prototype.render.call(this);

    if (this.node.label) {
      var labelEl = $$('.label', {
        text: this.node.label
      });
      this.content.appendChild(labelEl);
    }

    this.renderChildren();

    this.el.appendChild(this.content);

    return this;
  };
};

BoxView.Prototype.prototype = CompositeView.prototype;
BoxView.prototype = new BoxView.Prototype();

module.exports = BoxView;

},{"../../../substance/application":173,"../composite":36,"../node":97}],19:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./box'),
  View: require('./box_view')
};

},{"./box":17,"./box_view":18}],20:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Capitalize = function(node, doc) {
  Annotation.call(this, node, doc);
};

Capitalize.type = {
  id: "capitalize",
  parent: "annotation",
  properties: {}
};

Capitalize.Prototype = function() {};
Capitalize.Prototype.prototype = Annotation.prototype;
Capitalize.prototype = new Capitalize.Prototype();
Capitalize.prototype.constructor = Capitalize;

Capitalize.fragmentation = Annotation.DONT_CARE;

module.exports = Capitalize;

},{"../annotation/annotation":11}],21:[function(require,module,exports){

module.exports = {
  Model: require('./capitalize.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./capitalize.js":20}],22:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');

var Caption = function(node, document) {
  Document.Composite.call(this, node, document);
};

Caption.type = {
  "id": "caption",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "title": "paragraph",
    "children": ["array", "paragraph"]
  }
};

// This is used for the auto-generated docs
// -----------------
//

Caption.description = {
  "name": "Caption",
  "remarks": [
    "Container element for the textual description that is associated with a Figure, Table, Video node etc.",
    "This is the title for the figure or the description of the figure that prints or displays with the figure."
  ],
  "properties": {
    "title": "Caption title (optional)",
    "children": "0..n Paragraph nodes",
  }
};


// Example File
// -----------------
//

Caption.example = {
  "id": "caption_1",
  "children": [
    "paragraph_1",
    "paragraph_2"
  ]
};

Caption.Prototype = function() {

  this.getChildrenIds = function() {
    return this.properties.children || [];
  };

  this.hasTitle = function() {
    return (!!this.properties.title);
  };

  this.getTitle = function() {
    if (this.properties.title) return this.document.get(this.properties.title);
  };

};

Caption.Prototype.prototype = Document.Composite.prototype;
Caption.prototype = new Caption.Prototype();
Caption.prototype.constructor = Caption;

Document.Node.defineProperties(Caption);

module.exports = Caption;

},{"../../../substance/document":186}],23:[function(require,module,exports){
"use strict";

var CompositeView = require("../composite").View;
var $$ = require("../../../substance/application").$$;

// Lens.Caption.View
// ==========================================================================

var CaptionView = function(node, viewFactory) {
  CompositeView.call(this, node, viewFactory);
};

CaptionView.Prototype = function() {

  // Rendering
  // =============================
  //

  this.render = function() {
    this.content = $$('div.content');

    // Add title paragraph
    var titleNode = this.node.getTitle();
    if (titleNode) {
      var titleView = this.createChildView(this.node.title);
      var titleEl = titleView.render().el;
      titleEl.classList.add('caption-title');
      this.content.appendChild(titleEl);
    }

    this.renderChildren();

    this.el.appendChild(this.content);
    return this;
  };

};

CaptionView.Prototype.prototype = CompositeView.prototype;
CaptionView.prototype = new CaptionView.Prototype();

module.exports = CaptionView;

},{"../../../substance/application":173,"../composite":36}],24:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./caption"),
  View: require("./caption_view")
};

},{"./caption":22,"./caption_view":23}],25:[function(require,module,exports){
var _ = require('underscore');
var Document = require('../../../substance/document');

// Lens.Citation
// -----------------
//

var Citation = function(node, doc) {
  Document.Node.call(this, node, doc);
};

// Type definition
// -----------------
//

Citation.type = {
  "id": "article_citation", // type name
  "parent": "content",
  "properties": {
    "source_id": "string",
    "title": "string",
    "label": "string",
    "authors": ["array", "string"],
    "doi": "string",
    "source": "string",
    "volume": "string",
    "citation_type": "string",
    "publisher_name": "string",
    "publisher_location": "string",
    "fpage": "string",
    "lpage": "string",
    "year": "string",
    "comment": "string",
    "citation_urls": ["array", "object"],
    "source_formats": ["array", "object"]
  }
};

// This is used for the auto-generated docs
// -----------------
//

Citation.description = {
  "name": "Citation",
  "remarks": [
    "A journal citation.",
    "This element can be used to describe all kinds of citations."
  ],
  "properties": {
    "title": "The article's title",
    "label": "Optional label (could be a number for instance)",
    "doi": "DOI reference",
    "source": "Usually the journal name",
    "volume": "Issue number",
    "citation_type": "Citation Type",
    "publisher_name": "Publisher Name",
    "publisher_location": "Publisher Location",
    "fpage": "First page",
    "lpage": "Last page",
    "year": "The year of publication",
    "comment": "Author comment.",
    "citation_urls": "A list of links for accessing the article on the web"
  }
};



// Example Citation
// -----------------
//

Citation.example = {
  "id": "article_nature08160",
  "type": "article_citation",
  "label": "5",
  "title": "The genome of the blood fluke Schistosoma mansoni",
  "authors": [
    "M Berriman",
    "BJ Haas",
    "PT LoVerde"
  ],
  "citation_type": "Journal Article",
  "doi": "http://dx.doi.org/10.1038/nature08160",
  "source": "Nature",
  "volume": "460",
  "fpage": "352",
  "lpage": "8",
  "year": "1984",
  "comment": "This is a comment.",
  "citation_urls": [
    {
      "name": "PubMed",
      "url": "https://www.ncbi.nlm.nih.gov/pubmed/19606141"
    }
  ]
};


Citation.Prototype = function() {

  // Returns the citation URLs if available
  // Falls back to the DOI url
  // Always returns an array;
  this.urls = function() {
    return this.properties.citation_urls.length > 0 ? this.properties.citation_urls
                                                    : [this.properties.doi];
  };

  this.getHeader = function() {
    return _.compact([this.properties.label, this.properties.citation_type || locales.Reference]).join(' - ');
  };
};

Citation.Prototype.prototype = Document.Node.prototype;
Citation.prototype = new Citation.Prototype();
Citation.prototype.constructor = Citation;

Document.Node.defineProperties(Citation);

module.exports = Citation;

},{"../../../substance/document":186,"underscore":198}],26:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var $$ = require("../../../substance/application").$$;
var NodeView = require("../node").View;
var ResourceView = require('../../resource_view');

// Lens.Citation.View
// ==========================================================================


var CitationView = function(node, viewFactory, options) {
  NodeView.apply(this, arguments);

  // Mix-in
  ResourceView.call(this, options);

};


CitationView.Prototype = function() {

  // Mix-in
  _.extend(this, ResourceView.prototype);

  this.renderBody = function() {
    var frag = document.createDocumentFragment();
    var node = this.node;

    // Add title
    // -------

    var titleView = this.createTextPropertyView([node.id, 'title'], { classes: 'title' });
    frag.appendChild(titleView.render().el);

    // Add Authors
    // -------

    frag.appendChild($$('.authors', {
      html: node.authors.join(', ')
    }));

    // Add Source
    // -------

    var sourceText = "",
        sourceFrag = "",
        pagesFrag = "",
        publisherFrag = "";

    // Hack for handling unstructured citation types and render prettier
    if (node.source && node.volume === '') {
      sourceFrag = node.source;
    } else if (node.source && node.volume) {
      sourceFrag = [node.source, node.volume].join(', ');
    }

    if (node.fpage && node.lpage) {
      pagesFrag = [node.fpage, node.lpage].join('-');
    }

    // Publisher Frag

    var elems = [];

    if (node.publisher_name && node.publisher_location) {
      elems.push(node.publisher_name);
      elems.push(node.publisher_location);
    }

    if (node.year) {
      elems.push(node.year);
    }

    publisherFrag = elems.join(', ');

    // Put them together
    sourceText = sourceFrag;

    // Add separator only if there's content already, and more to display
    if (sourceFrag && (pagesFrag || publisherFrag)) {
      sourceText += ": ";
    }

    if (pagesFrag && publisherFrag) {
      sourceText += [pagesFrag, publisherFrag].join(", ");
    } else {
      // One of them without a separator char
      sourceText += pagesFrag;
      sourceText += publisherFrag;
    }

    frag.appendChild($$('.source', {
      html: sourceText
    }));

    if (node.comment) {
      var commentView = this.createTextView({ path: [node.id, 'comment'], classes: 'comment' });
      frag.appendChild(commentView.render().el);
    }

    // Add DOI (if available)
    // -------

    if (node.doi) {
      frag.appendChild($$('.doi', {
        children: [
          $$('b', {text: "DOI: "}),
          $$('a', {
            href: node.doi,
            target: "_new",
            text: node.doi
          })
        ]
      }));
    }

    // TODO: Add display citations urls
    // -------

    if (node.citation_urls.length > 0) {
      var citationUrlsEl = $$('.citation-urls');

      _.each(node.citation_urls, function(url) {
        citationUrlsEl.appendChild($$('a.url', {
          href: url.url,
          text: url.name,
          target: "_blank"
        }));
      });

      frag.appendChild(citationUrlsEl);      
    }

    this.content.appendChild(frag);
  };
};

CitationView.Prototype.prototype = NodeView.prototype;
CitationView.prototype = new CitationView.Prototype();
CitationView.prototype.constructor = CitationView;

module.exports = CitationView;

},{"../../../substance/application":173,"../../resource_view":140,"../node":97,"underscore":198}],27:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./citation'),
  View: require('./citation_view')
};

},{"./citation":25,"./citation_view":26}],28:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');
var ResourceReference = require('../resource_reference/resource_reference');

var CitationReference = function(node, doc) {
  ResourceReference.call(this, node, doc);
};

CitationReference.type = {
  id: "citation_reference",
  parent: "resource_reference",
  properties: {
    "target": "citation"
  }
};

CitationReference.Prototype = function() {};
CitationReference.Prototype.prototype = ResourceReference.prototype;
CitationReference.prototype = new CitationReference.Prototype();
CitationReference.prototype.constructor = CitationReference;

// Do not fragment this annotation
CitationReference.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(CitationReference);

module.exports = CitationReference;

},{"../../../substance/document":186,"../annotation/annotation":11,"../resource_reference/resource_reference":110}],29:[function(require,module,exports){

module.exports = {
  Model: require('./citation_reference.js'),
  View: require('../resource_reference/resource_reference_view.js')
};

},{"../resource_reference/resource_reference_view.js":111,"./citation_reference.js":28}],30:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Code = function(node, doc) {
  Annotation.call(this, node, doc);
};

Code.type = {
  id: "underline",
  parent: "annotation",
  properties: {}
};

Code.Prototype = function() {};
Code.Prototype.prototype = Annotation.prototype;
Code.prototype = new Code.Prototype();
Code.prototype.constructor = Code;

Code.fragmentation = Annotation.DONT_CARE;

module.exports = Code;

},{"../annotation/annotation":11}],31:[function(require,module,exports){

module.exports = {
  Model: require('./code.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./code.js":30}],32:[function(require,module,exports){
"use strict";

var Text = require("../text").Model;

var Codeblock = function(node, document) {
  Text.call(this, node, document);
};

// Type definition
// --------

Codeblock.type = {
  "id": "codeblock",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "content": "string"
  }
};

Codeblock.config = {
  "zoomable": true
};

// This is used for the auto-generated docs
// -----------------
//

Codeblock.description = {
  "name": "Codeblock",
  "remarks": [
    "Text in a codeblock is displayed in a fixed-width font, and it preserves both spaces and line breaks"
  ],
  "properties": {
    "content": "Content",
  }
};


// Example Formula
// -----------------
//

Codeblock.example = {
  "type": "codeblock",
  "id": "codeblock_1",
  "content": "var text = \"Sun\";\nvar op1 = null;\ntext = op2.apply(op1.apply(text));\nconsole.log(text);",
};

Codeblock.Prototype = function() {};

Codeblock.Prototype.prototype = Text.prototype;
Codeblock.prototype = new Codeblock.Prototype();
Codeblock.prototype.constructor = Codeblock;

module.exports = Codeblock;


},{"../text":129}],33:[function(require,module,exports){
"use strict";

var TextView = require('../text/text_view');

// Substance.Codeblock.View
// ==========================================================================

var CodeblockView = function(node) {
  TextView.call(this, node);
};

CodeblockView.Prototype = function() {};

CodeblockView.Prototype.prototype = TextView.prototype;
CodeblockView.prototype = new CodeblockView.Prototype();

module.exports = CodeblockView;

},{"../text/text_view":132}],34:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./codeblock"),
  View: require("./codeblock_view")
};

},{"./codeblock":32,"./codeblock_view":33}],35:[function(require,module,exports){
"use strict";

var NodeView = require("../node").View;

// Substance.Image.View
// ==========================================================================

var CompositeView = function(node, viewFactory) {
  NodeView.call(this, node, viewFactory);
  this.childrenViews = [];
};

CompositeView.Prototype = function() {

  // Rendering
  // =============================
  //

  this.render = function() {
    NodeView.prototype.render.call(this);

    this.renderChildren();
    return this;
  };

  this.renderChildren = function() {
    var children = this.node.getChildrenIds();
    // create children views
    for (var i = 0; i < children.length; i++) {
      var childView = this.createChildView(children[i]);
      var childViewEl = childView.render().el;
      this.content.appendChild(childViewEl);
    }
  };

  this.dispose = function() {
    NodeView.prototype.dispose.call(this);

    for (var i = 0; i < this.childrenViews.length; i++) {
      this.childrenViews[i].dispose();
    }
  };

  this.delete = function() {
  };

  this.getCharPosition = function(/*el, offset*/) {
    return 0;
  };

  this.getDOMPosition = function() {
    var content = this.$('.content')[0];
    var range = document.createRange();
    range.setStartBefore(content.childNodes[0]);
    return range;
  };

  this.createChildView = function(nodeId) {
    var view = this.createView(nodeId);
    this.childrenViews.push(view);
    return view;
  };

};

CompositeView.Prototype.prototype = NodeView.prototype;
CompositeView.prototype = new CompositeView.Prototype();

module.exports = CompositeView;

},{"../node":97}],36:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');

module.exports = {
  Model: Document.Composite,
  View: require("./composite_view")
};

},{"../../../substance/document":186,"./composite_view":35}],37:[function(require,module,exports){
var _ = require('underscore');
var Document = require('../../../substance/document');

// Lens.Contributor
// -----------------
//

var Contributor = function (node, doc) {
    Document.Node.call(this, node, doc);
};

// Type definition
// -----------------
//

Contributor.type = {
    "id": "contributor",
    "parent": "content",
    "properties": {
        "source_id": "string",
        "name": "string", // full name
        "role": "string",
        "contributor_type": "string",
        "affiliations": ["array", "affiliation"],
        "present_address": ["string"],
        "fundings": ["array", "string"],
        "image": "string", // optional
        "emails": ["array", "string"],
        "contribution": "string",
        "bio": ["array", "paragraph"],
        "deceased": "boolean",
        "members": ["array", "string"],
        "orcid": "string",
        "equal_contrib": ["array", "string"],
        "competing_interests": ["array", "string"]
    }
};

// This is used for the auto-generated docs
// -----------------
//

Contributor.description = {
    "name": "Contributor",
    "remarks": [
        "A contributor entity.",
    ],
    "properties": {
        "name": "Full name",
        "affiliations": "A list of affiliation ids",
        "present_address": "Present address of the contributor",
        "role": "Role of contributor (e.g. Author, Editor)",
        "fundings": "A list of funding descriptions",
        "deceased": false,
        "emails": "A list of emails",
        "orcid": "ORCID",
        "contribution": "Description of contribution",
        "equal_contrib": "A list of people who contributed equally",
        "competing_interests": "A list of conflicts",
        "members": "a list of group members"
    }
};


// Example Video
// -----------------
//

Contributor.example = {
    "id": "person_1",
    "type": "contributor",
    "name": "John Doe",
    "affiliations": ["affiliation_1", "affiliation_2"],
    "role": "Author",
    "fundings": ["Funding Organisation 1"],
    "emails": ["a@b.com"],
    "contribution": "Revising the article, data cleanup",
    "equal_contrib": ["John Doe", "Jane Doe"]
};


Contributor.Prototype = function () {

    this.getAffiliations = function () {
        return _.map(this.properties.affiliations, function (affId) {
            return this.document.get(affId);
        }, this);
    };

    this.getHeader = function () {
        return this.properties.contributor_type || 'Author';
    };



};

Contributor.Prototype.prototype = Document.Node.prototype;
Contributor.prototype = new Contributor.Prototype();
Contributor.prototype.constructor = Contributor;

Document.Node.defineProperties(Contributor);

module.exports = Contributor;

},{"../../../substance/document":186,"underscore":198}],38:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var NodeView = require("../node").View;
var $$ = require("../../../substance/application").$$;
var ResourceView = require('../../resource_view');

// Lens.Contributor.View
// ==========================================================================

var ContributorView = function(node, viewFactory, options) {
  NodeView.call(this, node, viewFactory);

  // Mix-in
  ResourceView.call(this, options);
};

ContributorView.Prototype = function() {

  // Mix-in
  _.extend(this, ResourceView.prototype);

  // Render it
  // --------
  //

  this.renderBody = function() {

    // Contributor Name
    // -------

    this.content.appendChild($$('.contributor-name', {text: this.node.name}));

    // Contributor Role
    // -------

    if (this.node.role) {
      this.content.appendChild($$('.role', {text: this.node.role}));
    }


    // Add Affiliations
    // -------

    this.content.appendChild($$('.affiliations', {
      children: _.map(this.node.getAffiliations(), function(aff) {

        var affText = _.compact([
          aff.department,
          aff.institution,
          aff.city,
          aff.country
        ]).join(', ');

        return $$('.affiliation', {text: affText});
      })
    }));


    // Present Address
    // -------

    if (this.node.present_address) {
      this.content.appendChild(
        $$('.present-address.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'Present address: '}),
            $$('span', {text: this.node.present_address})
          ]
        })
      );
    }

    // Contribution
    // -------

    if (this.node.contribution) {
      this.content.appendChild(
        $$('.contribution.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'Contribution: '}),
            $$('span', {text: this.node.contribution})
          ]
        })
      );
    }

    // Equal contribution
    // -------


    if (this.node.equal_contrib && this.node.equal_contrib.length > 0) {
      this.content.appendChild(
        $$('.equal-contribution.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'Contributed equally with: '}),
            $$('span', {text: this.node.equal_contrib.join(', ')})
          ]
        })
      );
    }


    // Emails
    // -------

    if (this.node.emails.length > 0) {
      this.content.appendChild(
        $$('.emails.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'For correspondence: '}),
            $$('span', {
              children: _.map(this.node.emails, function(email) {
                return $$('a', {href: "mailto:"+email, text: email+' '});
              })
            })
          ]
        })
      );
    }

    // Funding
    // -------

    if (this.node.fundings.length > 0) {
      this.content.appendChild(
        $$('.fundings.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'Funding: '}),
            $$('span', {
              text: this.node.fundings.join('; ')
            })
          ]
        })
      );
    }

    // Competing interests
    // -------


    if (this.node.competing_interests.length) {
      this.content.appendChild(
        $$('.competing-interests.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'Competing Interests: '}),
            $$('span', {
              text: this.node.competing_interests.join(', ')
            })
          ]
        })
      );
    }


    // ORCID if available
    // -------

    if (this.node.orcid) {
      this.content.appendChild(
        $$('.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'ORCID: '}),
            $$('a.orcid', { href: this.node.orcid, text: this.node.orcid })
          ]
        })
      );
    }



    // Group member (in case contributor is a person group)
    // -------

    if (this.node.members.length > 0) {
      this.content.appendChild(
        $$('.group-members.contrib-data', {
          children: [
            $$('span.contrib-label', {text: 'Group Members: '}),
            $$('span', {
              text: this.node.members.join(', ')
            })
          ]
        })
      );
    }

    // Contributor Bio
    // -------

    if (this.node.image || (this.node.bio && this.node.bio.length > 0) ) {
      var bio = $$('.bio');
      var childs = [$$('img', {src: this.node.image}), bio];

      _.each(this.node.bio, function(par) {
        bio.appendChild(this.createView(par).render().el);
      }, this);

      this.content.appendChild($$('.contributor-bio.container', {
        children: childs
      }));
    }

    // Deceased?
    // -------

    if (this.node.deceased) {
      this.content.appendChild($$('.label', {text: "* Deceased"}));
    }

  };

};

ContributorView.Prototype.prototype = NodeView.prototype;
ContributorView.prototype = new ContributorView.Prototype();

module.exports = ContributorView;

},{"../../../substance/application":173,"../../resource_view":140,"../node":97,"underscore":198}],39:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./contributor'),
  View: require('./contributor_view')
};

},{"./contributor":37,"./contributor_view":38}],40:[function(require,module,exports){
var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');
var ResourceReference = require('../resource_reference/resource_reference');

var ContributorReference = function(node, doc) {
  ResourceReference.call(this, node, doc);
};

ContributorReference.type = {
  id: "contributor_reference",
  parent: "resource_reference",
  properties: {
    "target": "contributor"
  }
};

ContributorReference.Prototype = function() {};
ContributorReference.Prototype.prototype = ResourceReference.prototype;
ContributorReference.prototype = new ContributorReference.Prototype();
ContributorReference.prototype.constructor = ContributorReference;

// Do not fragment this annotation
ContributorReference.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(ContributorReference);

module.exports = ContributorReference;

},{"../../../substance/document":186,"../annotation/annotation":11,"../resource_reference/resource_reference":110}],41:[function(require,module,exports){

module.exports = {
  Model: require('./contributor_reference.js'),
  View: require('../resource_reference/resource_reference_view.js')
};

},{"../resource_reference/resource_reference_view.js":111,"./contributor_reference.js":40}],42:[function(require,module,exports){
var _ = require('underscore');
var Document = require('../../../substance/document');

// Lens.Cover
// -----------------
//

var Cover = function(node, doc) {
  Document.Node.call(this, node, doc);
};

// Type definition
// -----------------
//

Cover.type = {
  "id": "cover",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "authors": ["array", "paragraph"],
    "breadcrumbs": "object",
    "abstract": "object"
    // No properties as they are all derived from the document node
  }
};


// This is used for the auto-generated docs
// -----------------
//

Cover.description = {
  "name": "Cover",
  "remarks": [
    "Virtual view on the title and authors of the paper."
  ],
  "properties": {
    "authors": "A paragraph that has the authors names plus references to the person cards"
  }
};

// Example Cover
// -----------------
//

Cover.example = {
  "id": "cover",
  "type": "cover"
};

Cover.Prototype = function() {

  this.getAuthors = function() {
    return _.map(this.properties.authors, function(paragraphId) {
      return this.document.get(paragraphId);
    }, this);
  };

  this.getTitle = function() {
    return this.document.title;
  };
  this.getAbstract = function () {
      return this.document.get(this.properties.abstract);
  }

};

Cover.Prototype.prototype = Document.Node.prototype;
Cover.prototype = new Cover.Prototype();
Cover.prototype.constructor = Cover;

Document.Node.defineProperties(Cover);

module.exports = Cover;

},{"../../../substance/document":186,"underscore":198}],43:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var NodeView = require("../node").View;
var $$ = require("../../../substance/application").$$;
var articleUtil = require("../../article_util");

// Lens.Cover.View
// ==========================================================================

var CoverView = function(node, viewFactory) {
  NodeView.call(this, node, viewFactory);
};

CoverView.Prototype = function() {

  // Render it
  // --------
  //
  // .content
  //   video
  //     source
  //   .title
  //   .caption
  //   .doi

  this.render = function() {
    NodeView.prototype.render.call(this);

    var node = this.node;
    var pubInfo = this.node.document.get('publication_info');


    // Render Subject(s) if available
    // --------------
    //

    if (pubInfo) {
      var subjects = pubInfo.subjects;
      if (subjects) {
        var subjectsEl
        if (pubInfo.subject_link) {
          subjectsEl = $$('.subjects', {
            children: _.map(pubInfo.getSubjectLinks(), function(subject) {
              return $$('a', {href: subject.url, text: subject.name})
            })
          })

        } else {
          subjectsEl = $$('.subjects', {
            html: subjects.join(' ')
          })
        }
        this.content.appendChild(subjectsEl);
      }
    }

    // Title View
    // --------------
    //

    var titleView = this.createTextPropertyView(['document', 'title'], { classes: 'title', elementType: 'div' });
    this.content.appendChild(titleView.render().el);

    // Render Authors
    // --------------
    //

    var authors = $$('.authors', {
      children: _.map(node.getAuthors(), function(authorPara) {
        var paraView = this.viewFactory.createView(authorPara);
        var paraEl = paraView.render().el;
        this.content.appendChild(paraEl);
        return paraEl;
      }, this)
    });

    authors.appendChild($$('.content-node.text.plain', {
      children: [
        $$('.content', {text: this.node.document.on_behalf_of})
      ]
    }));

    this.content.appendChild(authors);

    if (pubInfo) {
      var pubDate = pubInfo.published_on;
      var articleType = pubInfo.article_type;
      if (pubDate) {
        var items = [articleUtil.formatDate(pubDate)];

        if (articleType) {
          if (pubInfo.article_type_link) {
            var linkData = pubInfo.getArticleTypeLink()
            items.unshift('<a href="'+linkData.url+'">'+linkData.name+'</a>')
          } else {
            items.unshift(articleType)
          }

        }

        this.content.appendChild($$('.published-on', {
          html: items.join(' ')
        }));
      }
    }

    // Render Links
    // --------------
    //

    if (pubInfo && pubInfo.links.length > 0) {
      var linksEl = $$('.links');
      _.each(pubInfo.links, function(link) {
        if (link.type === "json" && link.url === "") {
          // Make downloadable JSON
          var json = JSON.stringify(this.node.document.toJSON(), null, '  ');
          var bb = new Blob([json], {type: "application/json"});

          linksEl.appendChild($$('a.json', {
            href: window.URL ? window.URL.createObjectURL(bb) : "#",
            html: '<i class="fa fa-external-link-square"></i> '+link.name,
            target: '_blank'
          }));

        } else {
          linksEl.appendChild($$('a.'+link.type, {
            href: link.url,
            html: '<i class="fa fa-external-link-square"></i> '+ link.name,
            target: '_blank'
          }));
        }
      }, this);

      this.content.appendChild(linksEl);
    }

    if (pubInfo) {
      var doi = pubInfo.doi;
      if (doi) {
        this.content.appendChild($$('.doi', {
          html: 'DOI: <a href="'+ 'https://doi.org/'+doi+'">'+doi+'</a>'
           }));
      }
    }
    if (node.getAbstract()) {
        var absView = this.viewFactory.createView(node.getAbstract());
        var absViewEL = absView.render().el;
        this.content.appendChild(absViewEL);
    }


      return this;
  };
};

CoverView.Prototype.prototype = NodeView.prototype;
CoverView.prototype = new CoverView.Prototype();

module.exports = CoverView;

},{"../../../substance/application":173,"../../article_util":4,"../node":97,"underscore":198}],44:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./cover'),
  View: require('./cover_view')
};

},{"./cover":42,"./cover_view":43}],45:[function(require,module,exports){
var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');

var CrossReference = function(node, doc) {
  Annotation.call(this, node, doc);
};

CrossReference.type = {
  id: "cross_reference",
  parent: "resource_reference",
  properties: {
    "target": "toc"
  }
};

CrossReference.Prototype = function() {};
CrossReference.Prototype.prototype = Annotation.prototype;
CrossReference.prototype = new CrossReference.Prototype();
CrossReference.prototype.constructor = CrossReference;

// Do not fragment this annotation
CrossReference.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(CrossReference);

module.exports = CrossReference;

},{"../../../substance/document":186,"../annotation/annotation":11}],46:[function(require,module,exports){
"use strict";

var AnnotationView = require('../annotation/annotation_view');

var CrossReferenceView = function(node, viewFactory) {
    AnnotationView.call(this, node, viewFactory);
    this.$el.addClass('cross-reference');
};

CrossReferenceView.Prototype = function() {
    this.createElement = function() {
        var el = document.createElement('a');
        el.setAttribute('href', '');
        return el;
    };
};
CrossReferenceView.Prototype.prototype = AnnotationView.prototype;
CrossReferenceView.prototype = new CrossReferenceView.Prototype();

module.exports = CrossReferenceView;

},{"../annotation/annotation_view":12}],47:[function(require,module,exports){

module.exports = {
  Model: require('./cross_reference.js'),
  View: require('./cross_reference_view.js')
};

},{"./cross_reference.js":45,"./cross_reference_view.js":46}],48:[function(require,module,exports){
var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');

var Custom = function(node, doc) {
  Annotation.call(this, node, doc);
};

Custom.type = {
  id: "custom_annotation",
  parent: "annotation",
  properties: {
    name: 'string'
  }
};

Custom.Prototype = function() {};
Custom.Prototype.prototype = Annotation.prototype;
Custom.prototype = new Custom.Prototype();
Custom.prototype.constructor = Custom;

Custom.fragmentation = Annotation.DONT_CARE;

Document.Node.defineProperties(Custom);

module.exports = Custom;

},{"../../../substance/document":186,"../annotation/annotation":11}],49:[function(require,module,exports){
var AnnotationView = require('../annotation').View;

var CustomAnnotationView = function(node) {
  AnnotationView.call(this, node);
};

CustomAnnotationView.Prototype = function() {

  this.setClasses = function() {
    AnnotationView.prototype.setClasses.call(this);
    this.$el.addClass(this.node.name);
  };

};
CustomAnnotationView.Prototype.prototype = AnnotationView.prototype;
CustomAnnotationView.prototype = new CustomAnnotationView.Prototype();

module.exports = CustomAnnotationView;

},{"../annotation":13}],50:[function(require,module,exports){

module.exports = {
  Model: require('./custom_annotation.js'),
  View: require('./custom_annotation_view.js')
};

},{"./custom_annotation.js":48,"./custom_annotation_view.js":49}],51:[function(require,module,exports){

var Document = require('../../../substance/document');

// Lens.Definition
// -----------------
//

var Definition = function(node) {
  Document.Node.call(this, node);
};

// Type definition
// -----------------
//

Definition.type = {
  "id": "definition", // type name
  "parent": "content",
  "properties": {
    "source_id": "string",
    "title": "string",
    "description": "string"
  }
};

// This is used for the auto-generated docs
// -----------------
//

Definition.description = {
  "name": "Definition",
  "remarks": [
    "A journal citation.",
    "This element can be used to describe all kinds of citations."
  ],
  "properties": {
    "title": "The article's title",
    "description": "Definition description",
  }
};


// Example Definition
// -----------------
//

Definition.example = {
  "id": "definition_def1",
  "type": "Definition",
  "title": "IAP",
  "description": "Integrated Analysis Platform",
};


Definition.Prototype = function() {
  // Returns the citation URLs if available
  // Falls back to the DOI url
  // Always returns an array;
  this.urls = function() {
    return this.properties.citation_urls.length > 0 ? this.properties.citation_urls
                                                    : [this.properties.doi];
  };

  this.getHeader = function() {
    if (this.properties.label) {
      return [this.properties.label,this.properties.title].join(". ");
    }
    else {
      return this.properties.title;
    }
  };

};

Definition.Prototype.prototype = Document.Node.prototype;
Definition.prototype = new Definition.Prototype();
Definition.prototype.constructor = Definition;

Document.Node.defineProperties(Definition);

module.exports = Definition;

},{"../../../substance/document":186}],52:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var NodeView = require("../node").View;
var $$ = require("../../../substance/application").$$;
var ResourceView = require('../../resource_view');

// Lens.Definition.View
// ==========================================================================

var DefinitionView = function(node, viewFactory, options) {
  NodeView.call(this, node, viewFactory);

  // Mix-in
  ResourceView.call(this, options);

};


DefinitionView.Prototype = function() {

  // Mix-in
  _.extend(this, ResourceView.prototype);

  this.renderBody = function() {
    this.content.appendChild($$('.description', {text: this.node.description }));
  };

};

DefinitionView.Prototype.prototype = NodeView.prototype;
DefinitionView.prototype = new DefinitionView.Prototype();
DefinitionView.prototype.constructor = DefinitionView;

module.exports = DefinitionView;

},{"../../../substance/application":173,"../../resource_view":140,"../node":97,"underscore":198}],53:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./definition'),
  View: require('./definition_view')
};

},{"./definition":51,"./definition_view":52}],54:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');
var ResourceReference = require('../resource_reference/resource_reference');

var DefinitionReference = function(node, doc) {
  ResourceReference.call(this, node, doc);
};

DefinitionReference.type = {
  id: "definition_reference",
  parent: "resource_reference",
  properties: {
    "target": "definition"
  }
};

DefinitionReference.Prototype = function() {};
DefinitionReference.Prototype.prototype = ResourceReference.prototype;
DefinitionReference.prototype = new DefinitionReference.Prototype();
DefinitionReference.prototype.constructor = DefinitionReference;

// Do not fragment this annotation
DefinitionReference.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(DefinitionReference);

module.exports = DefinitionReference;

},{"../../../substance/document":186,"../annotation/annotation":11,"../resource_reference/resource_reference":110}],55:[function(require,module,exports){

module.exports = {
  Model: require('./definition_reference.js'),
  View: require('../resource_reference/resource_reference_view.js')
};

},{"../resource_reference/resource_reference_view.js":111,"./definition_reference.js":54}],56:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');

var DocumentNode = function(node, document) {
  Document.Node.call(this, node, document);
};

DocumentNode.type = {
  "id": "document",
  "parent": "content",
  "properties": {
    "views": ["array", "view"],
    "guid": "string",
    "creator": "string",
    "title": "string",
    "authors": ["array", "contributor"],
    "on_behalf_of": "string",
    "abstract": "string"
  }
};

DocumentNode.Prototype = function() {
};

DocumentNode.Prototype.prototype = Document.Node.prototype;
DocumentNode.prototype = new DocumentNode.Prototype();
DocumentNode.prototype.constructor = DocumentNode;

Document.Node.defineProperties(DocumentNode);

module.exports = DocumentNode;

},{"../../../substance/document":186}],57:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./document_node"),
};

},{"./document_node":56}],58:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Emphasis = function(node, doc) {
  Annotation.call(this, node, doc);
};

Emphasis.type = {
  id: "emphasis",
  parent: "annotation",
  properties: {}
};

Emphasis.Prototype = function() {};
Emphasis.Prototype.prototype = Annotation.prototype;
Emphasis.prototype = new Emphasis.Prototype();
Emphasis.prototype.constructor = Emphasis;

Emphasis.fragmentation = Annotation.DONT_CARE;

module.exports = Emphasis;

},{"../annotation/annotation":11}],59:[function(require,module,exports){

module.exports = {
  Model: require('./emphasis.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./emphasis.js":58}],60:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');

var Figure = function(node, document) {
  Document.Composite.call(this, node, document);
};


Figure.type = {
  "parent": "content",
  "properties": {
    "source_id": "string",
    "label": "string",
    "url": "string",
    "caption": "caption",
    "position": "string", // 'float': default;figure goes into figure panel | 'anchor': figure is rendered in-flow
    "attrib": "string"
  }
};

Figure.config = {
  "zoomable": true
};

// This is used for the auto-generated docs
// -----------------
//

Figure.description = {
  "name": "Figure",
  "remarks": [
    "A figure is a figure is figure.",
  ],
  "properties": {
    "label": "Label used as header for the figure cards",
    "url": "Image url",
    "caption": "A reference to a caption node that describes the figure",
    "attrib": "Figure attribution"
  }
};

// Example File
// -----------------
//

Figure.example = {
  "id": "figure_1",
  "label": "Figure 1",
  "url": "http://example.com/fig1.png",
  "caption": "caption_1"
};

Figure.Prototype = function() {

  this.hasCaption = function() {
    return (!!this.properties.caption);
  };

  this.getChildrenIds = function() {
    var nodes = [];
    if (this.properties.caption) {
      nodes.push(this.properties.caption);
    }
    return nodes;
  };

  this.getCaption = function() {
    if (this.properties.caption) return this.document.get(this.properties.caption);
  };

  this.getHeader = function() {
    return this.properties.label;
  };

    this.includeInToc = function() {
        return true;
    };
};

Figure.Prototype.prototype = Document.Composite.prototype;
Figure.prototype = new Figure.Prototype();
Figure.prototype.constructor = Figure;

Document.Node.defineProperties(Figure.prototype, Object.keys(Figure.type.properties));

module.exports = Figure;

},{"../../../substance/document":186}],61:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var CompositeView = require("../composite").View;
var $$ = require ("../../../substance/application").$$;
var ResourceView = require('../../resource_view');

// Substance.Figure.View
// ==========================================================================

var FigureView = function(node, viewFactory, options) {
  CompositeView.call(this, node, viewFactory);

  
  // Mix-in
  ResourceView.call(this, options);
};

FigureView.Prototype = function() {

  // Mix-in
  _.extend(this, ResourceView.prototype);

  this.isZoomable = true;

  // Rendering
  // =============================
  //

  this.renderBody = function() {
    this.content.appendChild($$('.label', {text: this.node.label}));

    if (this.node.url) {
      // Add graphic (img element)
      var imgEl = $$('.image-wrapper', {
        children: [
          $$("a", {
            href: this.node.url,
            target: "_blank",
            children: [$$("img", {src: this.node.url})]
          })
        ]
      });
      this.content.appendChild(imgEl);
    }
    this.renderChildren();
    // Attrib
    if (this.node.attrib) {
      this.content.appendChild($$('.figure-attribution', {text: this.node.attrib}));
    }
  };

  this.renderLabel = function() {
    var labelEl = $$('.name', {
      href: "#"
    });

    this.renderAnnotatedText([this.node.id, 'label'], labelEl);
    return labelEl;
  };

};

FigureView.Prototype.prototype = CompositeView.prototype;
FigureView.prototype = new FigureView.Prototype();

module.exports = FigureView;

},{"../../../substance/application":173,"../../resource_view":140,"../composite":36,"underscore":198}],62:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./figure'),
  View: require('./figure_view')
};

},{"./figure":60,"./figure_view":61}],63:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');
var ResourceReference = require('../resource_reference/resource_reference');

var FigureReference = function(node, doc) {
  ResourceReference.call(this, node, doc);
};

FigureReference.type = {
  id: "figure_reference",
  parent: "resource_reference",
  properties: {
    "target": "figure"
  }
};

FigureReference.Prototype = function() {};
FigureReference.Prototype.prototype = ResourceReference.prototype;
FigureReference.prototype = new FigureReference.Prototype();
FigureReference.prototype.constructor = FigureReference;

// Do not fragment this annotation
FigureReference.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(FigureReference);

module.exports = FigureReference;

},{"../../../substance/document":186,"../annotation/annotation":11,"../resource_reference/resource_reference":110}],64:[function(require,module,exports){

module.exports = {
  Model: require('./figure_reference.js'),
  View: require('../resource_reference/resource_reference_view.js')
};

},{"../resource_reference/resource_reference_view.js":111,"./figure_reference.js":63}],65:[function(require,module,exports){
var _ = require('underscore');
var Document = require('../../../substance/document');

// Lens.Footnote
// -----------------
//

var Footnote = function(node, doc) {
  Document.Node.call(this, node, doc);
};

// Type definition
// -----------------
//

Footnote.type = {
  "id": "article_footnote", // type name
  "parent": "content",
  "properties": {
    "source_id": "string",
    "text": "object",
    "label": "string",
    "authors": ["array", "string"],
    "doi": "string",
    "source": "string",
    "volume": "string",
    "citation_type": "string",
    "publisher_name": "string",
    "publisher_location": "string",
    "fpage": "string",
    "lpage": "string",
    "year": "string",
    "comment": "string",
    "citation_urls": ["array", "object"],
    "source_formats": ["array", "object"]
  }
};

// This is used for the auto-generated docs
// -----------------
//

Footnote.description = {
  "name": "Footnote",
  "remarks": [
    "A journal citation.",
    "This element can be used to describe all kinds of citations."
  ],
  "properties": {
    "title": "The article's title",
    "label": "Optional label (could be a number for instance)",
    "doi": "DOI reference",
    "source": "Usually the journal name",
    "volume": "Issue number",
    "citation_type": "Footnote Type",
    "publisher_name": "Publisher Name",
    "publisher_location": "Publisher Location",
    "fpage": "First page",
    "lpage": "Last page",
    "year": "The year of publication",
    "comment": "Author comment.",
    "citation_urls": "A list of links for accessing the article on the web"
  }
};



// Example Footnote
// -----------------
//

Footnote.example = {
  "id": "article_nature08160",
  "type": "article_citation",
  "label": "5",
  "title": "The genome of the blood fluke Schistosoma mansoni",
  "authors": [
    "M Berriman",
    "BJ Haas",
    "PT LoVerde"
  ],
  "citation_type": "Journal Article",
  "doi": "http://dx.doi.org/10.1038/nature08160",
  "source": "Nature",
  "volume": "460",
  "fpage": "352",
  "lpage": "8",
  "year": "1984",
  "comment": "This is a comment.",
  "citation_urls": [
    {
      "name": "PubMed",
      "url": "http://www.ncbi.nlm.nih.gov/pubmed/19606141"
    }
  ]
};


Footnote.Prototype = function() {

  // Returns the citation URLs if available
  // Falls back to the DOI url
  // Always returns an array;
  this.urls = function() {
    return this.properties.citation_urls.length > 0 ? this.properties.citation_urls
                                                    : [this.properties.doi];
  };

  this.getHeader = function() {
    return _.compact([this.properties.label, this.properties.citation_type || locales.Reference]).join(' - ');
  };
};

Footnote.Prototype.prototype = Document.Node.prototype;
Footnote.prototype = new Footnote.Prototype();
Footnote.prototype.constructor = Footnote;

Document.Node.defineProperties(Footnote);

module.exports = Footnote;

},{"../../../substance/document":186,"underscore":198}],66:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var $$ = require("../../../substance/application").$$;
var NodeView = require("../node").View;
var ResourceView = require('../../resource_view');

// Lens.Citation.View
// ==========================================================================


var CitationView = function (node, viewFactory, options) {
    NodeView.apply(this, arguments);

    // Mix-in
    ResourceView.call(this, options);

};


CitationView.Prototype = function () {

    // Mix-in
    _.extend(this, ResourceView.prototype);

    this.renderBody = function () {
        var frag = document.createDocumentFragment();
        var node = this.node;
        var i,j;


        // Add text
        // -------
        //
        var italic, xref;

        var texts = node.properties.text;

    for (i=0; i< texts.length; i++) {
        var text = texts[i].nodes;
        var div= document.createElement("div");
        console.log('footnote text',text);
        if (text !== undefined) {
            for (j = 0; j < text.length; j++) {
                console.log('text[j]',text[j]);
                if (text[j].tagName == 'italic') {
                    italic = document.createElement('span');
                    italic.className = "citation-italic";
                    italic.innerHTML = text[j].innerHTML;
                    div.appendChild(italic);
                }
                else if (text[j].tagName == 'xref' && text[j].getAttribute('ref-type') === "sec") {
                    xref = document.createElement("a");
                    xref.className = "annotation cross_reference cross-reference";
                    xref.setAttribute("data-id", text[j].target);
                    xref.innerHTML = text[j].innerHTML;
                    div.appendChild(xref);

                }
                else if (text[j].tagName == 'xref' && text[j].getAttribute('ref-type') === "bibr") {
                    xref = document.createElement("a");
                    xref.setAttribute("href", '#citations/'+text[j].target);
                    xref.innerHTML = text[j].innerHTML;
                    div.appendChild(xref);

                }
                else {
                    if (text[j].tagName == 'ext-link') {

                        xref = document.createElement("a");
                        xref.className = "content-node link";
                        xref.setAttribute("href", text[j]);
                        xref.setAttribute("target", "_blank");
                        var href = text[j].getAttributeNodeNS("http://www.w3.org/1999/xlink", "href")
                        if (href) {
                            xref.innerHTML = text[j].innerHTML;
                            xref.setAttribute("href", href.textContent);
                        }

                        div.appendChild(xref);

                    }
                    else {
                        div.appendChild(text[j]);
                    }

                }
            }
            frag.appendChild(div);
        }
    }



        // Add Authors
        // -------
        frag.appendChild($$('.authors', {
            html: node.authors.join(', ')
        }));

        // Add Source
        // -------

        var sourceText = "",
            sourceFrag = "",
            pagesFrag = "",
            publisherFrag = "";

        // Hack for handling unstructured citation types and render prettier
        if (node.source && node.volume === '') {
            sourceFrag = node.source;
        } else if (node.source && node.volume) {
            sourceFrag = [node.source, node.volume].join(', ');
        }

        if (node.fpage && node.lpage) {
            pagesFrag = [node.fpage, node.lpage].join('-');
        }

        // Publisher Frag

        var elems = [];

        if (node.publisher_name && node.publisher_location) {
            elems.push(node.publisher_name);
            elems.push(node.publisher_location);
        }

        if (node.year) {
            elems.push(node.year);
        }

        publisherFrag = elems.join(', ');

        // Put them together
        sourceText = sourceFrag;

        // Add separator only if there's content already, and more to display
        if (sourceFrag && (pagesFrag || publisherFrag)) {
            sourceText += ": ";
        }

        if (pagesFrag && publisherFrag) {
            sourceText += [pagesFrag, publisherFrag].join(", ");
        } else {
            // One of them without a separator char
            sourceText += pagesFrag;
            sourceText += publisherFrag;
        }

        frag.appendChild($$('.source', {
            html: sourceText
        }));

        if (node.comment) {
            var commentView = this.createTextView({path: [node.id, 'comment'], classes: 'comment'});
            frag.appendChild(commentView.render().el);
        }

        // Add DOI (if available)
        // -------

        if (node.doi) {
            frag.appendChild($$('.doi', {
                children: [
                    $$('b', {text: "DOI: "}),
                    $$('a', {
                        href: node.doi,
                        target: "_new",
                        text: node.doi
                    })
                ]
            }));
        }

        if (node.citation_urls.length > 0) {
            var citationUrlsEl = $$('.citation-urls');

            _.each(node.citation_urls, function (url) {
                citationUrlsEl.appendChild($$('a.url', {
                    href: url.url,
                    text: url.name,
                    target: "_blank"
                }));
            });

            frag.appendChild(citationUrlsEl);
        }
        this.content.appendChild(frag);
    };
};

CitationView.Prototype.prototype = NodeView.prototype;
CitationView.prototype = new CitationView.Prototype();
CitationView.prototype.constructor = CitationView;

module.exports = CitationView;

},{"../../../substance/application":173,"../../resource_view":140,"../node":97,"underscore":198}],67:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./footnote'),
  View: require('./footnote_view')
};

},{"./footnote":65,"./footnote_view":66}],68:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');
var ResourceReference = require('../resource_reference/resource_reference');

var FootnoteReference = function(node, doc) {
  ResourceReference.call(this, node, doc);
};

FootnoteReference.type = {
  id: "footnote_reference",
  parent: "resource_reference",
  properties: {
    "target": "footnote"
  }
};

FootnoteReference.Prototype = function() {};
FootnoteReference.Prototype.prototype = ResourceReference.prototype;
FootnoteReference.prototype = new FootnoteReference.Prototype();
FootnoteReference.prototype.constructor = FootnoteReference;

// Do not fragment this annotation
FootnoteReference.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(FootnoteReference);

module.exports = FootnoteReference;

},{"../../../substance/document":186,"../annotation/annotation":11,"../resource_reference/resource_reference":110}],69:[function(require,module,exports){

module.exports = {
  Model: require('./footnote_reference.js'),
  View: require('../resource_reference/resource_reference_view.js')
};


},{"../resource_reference/resource_reference_view.js":111,"./footnote_reference.js":68}],70:[function(require,module,exports){

var Document = require('../../../substance/document');

// Formula
// -----------------
//

var Formula = function(node) {
  Document.Node.call(this, node);
};

// Type definition
// -----------------
//

Formula.type = {
  "id": "formula",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "inline": "boolean",
    // a reference label as typically used in display formulas
    "label": "string",
    // we support multiple representations of the formula
    "format": ["array", "string"],
    "data": ["array", "string"],
  }
};


// This is used for the auto-generated docs
// -----------------
//

Formula.description = {
  "name": "Formula",
  "remarks": [
    "Can either be expressed in MathML format or using an image url"
  ],
  "properties": {
    "label": "Formula label (4)",
    "data": "Formula data, either MathML or image url",
    "format": "Can either be `mathml` or `image`"
  }
};


// Example Formula
// -----------------
//

Formula.example = {
  "type": "formula",
  "id": "formula_eqn1",
  "label": "(1)",
  "content": "<mml:mrow>...</mml:mrow>",
  "format": "mathml"
};

Formula.Prototype = function() {
  this.inline = false;
};

Formula.Prototype.prototype = Document.Node.prototype;
Formula.prototype = new Formula.Prototype();
Formula.prototype.constuctor = Formula;

Document.Node.defineProperties(Formula);

module.exports = Formula;

},{"../../../substance/document":186}],71:[function(require,module,exports){
"use strict";

var NodeView = require('../node').View;

// FormulaView
// ===========

var FormulaView = function(node, viewFactory) {
  NodeView.call(this, node, viewFactory);
};

FormulaView.Prototype = function() {

  var _types = {
    "latex": "math/tex",
    "mathml": "math/mml"
  };

  var _precedence = {
    "image": 0,
    "mathml": 1,
    "latex": 2
  };

  // Render the formula
  // --------

  this.render = function() {
    if (this.node.inline) {
      this.$el.addClass('inline');
    }

    var inputs = [], i;
    for (i=0; i<this.node.data.length; i++) {
      inputs.push({
        format: this.node.format[i],
        data: this.node.data[i]
      });
    }
    inputs.sort(function(a, b) {
      return _precedence[a.format] - _precedence[b.format];
    });

    if (inputs.length > 0) {
      // TODO: we should allow to make it configurable
      // which math source format should be used in first place
      // For now, we take the first available format which is not image
      // and use the image to configure MathJax's preview.
      var hasPreview = false;
      var hasSource = false;
      for (i=0; i<inputs.length; i++) {
        var format = inputs[i].format;
        var data = inputs[i].data;
        switch (format) {
          // HACK: ATM, in certain cases there are MJ issues
          // until then we just put the mml into root, and do not render the preview
          case "mathml":
            if (!hasSource) {
              this.$el.append($(data));
              hasSource = true;
              // prevent preview for the time being (HACK), as otherwise there will be two presentations
              if (hasPreview) {
                this.$preview.hide();
                hasPreview = true;
              }
            }
            break;
          case "latex":
            if (!hasSource) {
              var type = _types[format];
              if (!this.node.inline) type += "; mode=display";
              var $scriptEl = $('<script>')
                .attr('type', type)
                .html(data);
              this.$el.append($scriptEl);
              hasSource = true;
            }
            break;
          case "image":
            if (!hasPreview) {
              var $preview = $('<div>').addClass('MathJax_Preview');
              $preview.append($('<img>').attr('src', data));
              this.$el.append($preview);
              this.$preview = $preview;
              hasPreview = true;
            }
            break;
          default:
            console.error("Unknown formula format:", format);
        }
      }
    }
    // Add label to block formula
    // --------
    if (this.node.label) {
      this.$el.append($('<div class="label">').html(this.node.label));
    }
    return this;
  };
};

FormulaView.Prototype.prototype = NodeView.prototype;
FormulaView.prototype = new FormulaView.Prototype();

module.exports = FormulaView;

},{"../node":97}],72:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./formula'),
  View: require('./formula_view')
};

},{"./formula":70,"./formula_view":71}],73:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');
var DocumentNode = Document.Node;
var Text = require("../text/text_node");

var Heading = function (node, document) {
    Text.call(this, node, document);
};

// Type definition
// -----------------
//

Heading.type = {
    "id": "heading",
    "parent": "content",
    "properties": {
        "source_id": "string",
        "content": "string",
        "label": "string",
        "level": "number",
        "authors": ["array", "string"]
    }
};

// Example Heading
// -----------------
//

Heading.example = {
    "type": "heading",
    "id": "heading_1",
    "content": "Introduction",
    "level": 1
};

// This is used for the auto-generated docs
// -----------------
//


Heading.description = {
    "name": "Heading",
    "remarks": [
        "Denotes a section or sub section in your article."
    ],
    "properties": {
        "content": "Heading title",
        "label": "Heading label",
        "level": "Heading level. Ranges from 1..4"
    }
};

Heading.Prototype = function () {

    this.splitInto = 'paragraph';

    // TOC API

    this.includeInToc = function () {
        return true;
    };

    this.getLevel = function () {
        return this.level;
    }

};

Heading.Prototype.prototype = Text.prototype;
Heading.prototype = new Heading.Prototype();
Heading.prototype.constructor = Heading;

DocumentNode.defineProperties(Heading);

module.exports = Heading;

},{"../../../substance/document":186,"../text/text_node":130}],74:[function(require,module,exports){
"use strict";

var NodeView = require("../node").View;
var $$ = require("../../../substance/application").$$;


// Substance.Heading.View
// ==========================================================================

var HeadingView = function (node, viewFactory) {
    NodeView.call(this, node, viewFactory);

    this.$el.addClass('level-' + this.node.level);
};

HeadingView.Prototype = function () {

    this.render = function () {
        if (this.node.content.length) {
            NodeView.prototype.render.call(this);
            // Heading title

            var titleView = this.createTextPropertyView([this.node.id, 'content'], {
                classes: 'title'
            });

            if (this.node.label) {
                var labelEl = $$('.label', {text: this.node.label});
                this.content.appendChild(labelEl);
            }

            this.content.appendChild(titleView.render().el);
        }
        return this;
    };

    this.renderTocItem = function () {
        var el = $$('div');
        if (this.node.label) {
            var labelEl = $$('.label', {text: this.node.label});
            el.appendChild(labelEl);
        }
        var titleEl = $$('span');
        this.renderAnnotatedText([this.node.id, 'content'], titleEl);
        el.appendChild(titleEl);
        if (this.node.authors !== undefined) {
            if (this.node.authors.length > 0) {
                var authors = $$('div');
                var $authors = $(authors);
                $authors.addClass('authors');
                for (var i = 0; i < this.node.authors.length; i++) {
                    var authorsEl = document.createElement('span');
                    var $authorsEl = $(authorsEl);
                    $authorsEl.addClass('author');
                    authorsEl.appendChild(document.createTextNode(this.node.authors[i]));
                    authors.appendChild(authorsEl);
                    el.appendChild(authors);
                }
            }
        }



        return el;
    };

};

HeadingView.Prototype.prototype = NodeView.prototype;
HeadingView.prototype = new HeadingView.Prototype();

module.exports = HeadingView;

},{"../../../substance/application":173,"../node":97}],75:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./heading"),
  View: require("./heading_view")
};

},{"./heading":73,"./heading_view":74}],76:[function(require,module,exports){
var _ = require('underscore');
var Document = require('../../../substance/document');
var Composite = Document.Composite;

// Lens.Speech
// -----------------
//

var HTMLTable = function (node, doc) {
    Composite.call(this, node, doc);
};

// Type definition
// -----------------
//

HTMLTable.type = {
    "id": "html_table",
    "parent": "content",
    "properties": {
        "source_id": "string",
        "label": "string",
        "children": "object",
        "footers": ["array", "string"],
        "caption": "caption",
        "html_table_attributes":"object"
    }
};

HTMLTable.config = {
    "zoomable": true
};




HTMLTable.description = {
    "name": "HTMLTable",
    "remarks": [
        "A table figure which is expressed in HTML notation"
    ],
    "properties": {
        "source_id": "string",
        "label": "Label shown in the resource header.",
        "title": "Full table title",
        "children": "object",
        "footers": "HTMLTable footers expressed as an array strings",
        "caption": "References a caption node, that has all the content",
        "html_table_attributes": "Named Node map of attributes"
    }
};


// Example HTMLTable
// -----------------
//

HTMLTable.example = {
    "id": "html_table_1",
    "type": "html_table",
    "label": "HTMLTable 1.",
    "title": "Lorem ipsum table",
    "children": "object",
    "footers": [],
    "caption": "caption_1"
};


HTMLTable.Prototype = function () {
    this.getChildrenIds = function () {
        return this.properties.children;
    };

    this.getCaption = function () {
        if (this.properties.caption) return this.document.get(this.properties.caption);
    };

    this.getHeader = function () {
        return this.properties.label;
    };
};

HTMLTable.Prototype.prototype = Composite.prototype;
HTMLTable.prototype = new HTMLTable.Prototype();
HTMLTable.prototype.constructor = HTMLTable;

Document.Node.defineProperties(HTMLTable);

module.exports = HTMLTable;

},{"../../../substance/document":186,"underscore":198}],77:[function(require,module,exports){
"use strict";

var NodeView = require('../node').View;
var CompositeView = require("../composite").View;

var $$ = require("../../../substance/application").$$;


var HTMLTableView = function (node, viewFactory) {
    CompositeView.call(this, node, viewFactory);
};

HTMLTableView.Prototype = function () {

    this.render = function () {

        NodeView.prototype.render.call(this);
        var i, childView, childViewEl, htmlTable, row, tr, td;
        htmlTable = document.createElement('table');
        var attrs = this.node.properties.html_table_attributes;
        if (attrs.length > 0) {
            for (var k=0; k < attrs.length; k++) {
                htmlTable.setAttribute(attrs[k].nodeName, attrs[k].nodeValue);
            }
        }

        if (attrs.getNamedItem('specific-use')===null) {
            htmlTable.setAttribute('class', 'layout-tabelle');
        }
        else {
            htmlTable.setAttribute('class', attrs.getNamedItem('specific-use').nodeValue);
        }

        var tr, i, j, k;
        var rows = this.node.getChildrenIds();

        if (rows !== undefined) {
            for (var r in rows) {
                row = rows[r];
                tr = document.createElement('tr');
                for (i in row) {
                    td = document.createElement('td');
                    var cell = row[i];
                    for (j in cell) {
                        var cell_nodes = cell[j].nodes;
                        var attr = cell[j].attributes;
                        if (cell_nodes !== undefined) {
                            for (var k = 0; k < cell_nodes.length; k++) {
                                childView = this.createChildView(cell_nodes[k].id);
                                childViewEl = childView.render().el;
                                td.appendChild(childViewEl);

                            }
                            for (var m=0; m < attr.length; m++) {
                                td.setAttribute(attr[m].nodeName, attr[m].nodeValue);

                            }
                        }


                    }
                    tr.appendChild(td);
                    htmlTable.appendChild(tr);
                }
            }
        }

        this.content.appendChild(htmlTable);

        this.el.appendChild(this.content);

        return this;
    };
};

HTMLTableView.Prototype.prototype = CompositeView.prototype;
HTMLTableView.prototype = new HTMLTableView.Prototype();

module.exports = HTMLTableView;


/**
 var footers = $$('.footers', {
      children: _.map(this.node.footers, function(footer) {
        return $$('.footer', { html: "<b>"+footer.label+"</b> " + footer.content });
      })
    });

 // Display caption


 if (this.node.caption) {
      var captionView = this.createView(this.node.caption);
      this.content.appendChild(captionView.render().el);
    }

 this.content.appendChild(footers);
 **/

},{"../../../substance/application":173,"../composite":36,"../node":97}],78:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./html_table'),
  View: require('./html_table_view')
};

},{"./html_table":76,"./html_table_view":77}],79:[function(require,module,exports){
"use strict";

var DocumentNode = require('../../../substance/document').Node;
var WebResource = require("../web_resource").Model;

var ImageNode = function(node, document) {
  WebResource.call(this, node, document);
};

// Type definition
// -----------------
//

ImageNode.type = {
  "id": "image",
  "parent": "webresource",
  "properties": {
    "source_id": "string"
  }
};

// Example Image
// -----------------
//

ImageNode.example = {
  "type": "image",
  "id": "image_1",
  "url": "http://substance.io/image_1.png"
};

// This is used for the auto-generated docs
// -----------------
//


ImageNode.description = {
  "name": "Image",
  "remarks": [
    "Represents a web-resource for an image."
  ],
  "properties": {}
};

ImageNode.Prototype = function() {};

ImageNode.Prototype.prototype = WebResource.prototype;
ImageNode.prototype = new ImageNode.Prototype();
ImageNode.prototype.constructor = ImageNode;

module.exports = ImageNode;

},{"../../../substance/document":186,"../web_resource":138}],80:[function(require,module,exports){
"use strict";

var NodeView = require("../node").View;

// Substance.Image.View
// ==========================================================================

var ImageView = function(node, viewFactory) {
  NodeView.call(this, node, viewFactory);
};

ImageView.Prototype = function() {

  // Rendering
  // =============================
  //

  var _indexOf = Array.prototype.indexOf;

  // Render Markup
  // --------
  //
  // div.content
  //   div.img-char
  //     .img

  this.render = function() {

    var content = document.createElement('div');
    content.className = 'content';

    var imgChar = document.createElement('div');
    imgChar.className = 'image-char';
    this._imgChar = imgChar;

    var img = document.createElement('img');
    img.src = this.node.url;
    img.alt = "alt text";
    img.title = "alt text";
    imgChar.appendChild(img);

    content.appendChild(imgChar);

    // Add content
    this.el.appendChild(content);

    this._imgPos = _indexOf.call(imgChar.childNodes, img);

    return this;
  };

  this.delete = function(pos, length) {
    var content = this.$('.content')[0];
    var spans = content.childNodes;
    for (var i = length - 1; i >= 0; i--) {
      content.removeChild(spans[pos+i]);
    }
  };

  this.getCharPosition = function(el, offset) {
    // TODO: is there a more general approach? this is kind of manually coded.

    if (el === this._imgChar) {
      return (offset > this._imgPos) ? 1 : 0;
    }

    console.log("Errhhh..");

  };

  this.getDOMPosition = function(charPos) {
    var content = this.$('.content')[0];
    var range = document.createRange();
    if (charPos === 0) {
      range.setStartBefore(content.childNodes[0]);
    } else {
      range.setStartAfter(content.childNodes[0]);
    }
    return range;
  };
};

ImageView.Prototype.prototype = NodeView.prototype;
ImageView.prototype = new ImageView.Prototype();

module.exports = ImageView;

},{"../node":97}],81:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./image"),
  View: require("./image_view")
};

},{"./image":79,"./image_view":80}],82:[function(require,module,exports){
"use strict";

module.exports = {
  /* basic/abstract node types */
  "node": require("./node"),
  "capitalize": require("./capitalize"),
  "composite": require("./composite"),
  "annotation": require("./annotation"),
  /* Annotation types */
  "emphasis": require("./emphasis"),
  "strong": require("./strong"),
  "subscript": require("./subscript"),
  "superscript": require("./superscript"),
  "underline": require("./underline"),
  "code": require("./code"),
  "author_callout": require("./author_callout"),
  "custom_annotation": require("./custom_annotation"),
  "inline-formula": require("./inline_formula"),
  /* Reference types */
  "resource_reference": require("./resource_reference"),
  "contributor_reference": require("./contributor_reference"),
  "figure_reference": require("./figure_reference"),
  "citation_reference": require("./citation_reference"),
  "footnote_reference": require("./footnote_reference"),
  "definition_reference": require("./definition_reference"),
  "cross_reference": require("./cross_reference"),
  "publication_info": require("./publication_info"),
  /* Annotation'ish content types */
  "link": require("./link"),
  "inline_image": require("./inline_image"),
  /* Content types */
  "abstract": require("./abstract"),
  "document": require("./document"),
  "text": require("./text"),
  "paragraph": require("./paragraph"),
  "heading": require("./heading"),
  "box": require("./box"),
  "cover": require("./cover"),
  "figure": require("./figure"),
  "caption": require("./caption"),
  "image": require("./image"),
  "webresource": require("./web_resource"),
  "html_table": require("./html_table"),
  "supplement": require("./supplement"),
  "video": require("./video"),
  "contributor": require("./contributor"),
  "definition": require("./definition"),
  "citation": require("./citation"),
  "mixed_citation": require("./mixed_citation"),
  "formula": require('./formula'),
  "list": require("./list"),
  "codeblock": require("./codeblock"),
  "affiliation": require("./_affiliation"),
  "footnote": require("./footnote"),
  "quote": require("./quote"),
  "speech": require("./speech"),
  "strike": require("./strike"),
  "sec_meta": require("./sec_meta")
};

},{"./_affiliation":7,"./abstract":10,"./annotation":13,"./author_callout":16,"./box":19,"./capitalize":21,"./caption":24,"./citation":27,"./citation_reference":29,"./code":31,"./codeblock":34,"./composite":36,"./contributor":39,"./contributor_reference":41,"./cover":44,"./cross_reference":47,"./custom_annotation":50,"./definition":53,"./definition_reference":55,"./document":57,"./emphasis":59,"./figure":62,"./figure_reference":64,"./footnote":67,"./footnote_reference":69,"./formula":72,"./heading":75,"./html_table":78,"./image":81,"./inline_formula":83,"./inline_image":86,"./link":88,"./list":91,"./mixed_citation":94,"./node":97,"./paragraph":100,"./publication_info":103,"./quote":106,"./resource_reference":109,"./sec_meta":112,"./speech":115,"./strike":118,"./strong":120,"./subscript":122,"./superscript":124,"./supplement":126,"./text":129,"./underline":133,"./video":135,"./web_resource":138}],83:[function(require,module,exports){

module.exports = {
  Model: require('./inline_formula.js'),
  View: require('./inline_formula_view.js')
};

},{"./inline_formula.js":84,"./inline_formula_view.js":85}],84:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');

var InlineFormula = function(node, doc) {
  Annotation.call(this, node, doc);
};

InlineFormula.type = {
  id: "inline-formula",
  parent: "annotation",
  properties: {
    target: "formula"
  }
};

InlineFormula.Prototype = function() {};
InlineFormula.Prototype.prototype = Annotation.prototype;
InlineFormula.prototype = new InlineFormula.Prototype();
InlineFormula.prototype.constructor = InlineFormula;

InlineFormula.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(InlineFormula);

module.exports = InlineFormula;

},{"../../../substance/document":186,"../annotation/annotation":11}],85:[function(require,module,exports){
"use strict";

var ResourceReferenceView = require('../resource_reference').View;

var InlineFormulaView = function(node, viewFactory) {
  ResourceReferenceView.call(this, node, viewFactory);
  $(this.el).removeClass('resource-reference');
};

InlineFormulaView.Prototype = function() {

  this.createElement = function() {
    var el = document.createElement('span');
    return el;
  };

  this.render = function() {
    var formula = this.node.document.get(this.node.target);
    var formulaView = this.viewFactory.createView(formula);
    this.el.innerHTML = formulaView.render().el.innerHTML;
    return this;
  };

};
InlineFormulaView.Prototype.prototype = ResourceReferenceView.prototype;
InlineFormulaView.prototype = new InlineFormulaView.Prototype();

module.exports = InlineFormulaView;

},{"../resource_reference":109}],86:[function(require,module,exports){

module.exports = {
  Model: require('./inline_image.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./inline_image.js":87}],87:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');

var InlineImage = function(node, doc) {
  Annotation.call(this, node, doc);
};

InlineImage.type = {
  id: "inline-image",
  parent: "annotation",
  properties: {
    "target": "image"
  }
};

InlineImage.Prototype = function() {};
InlineImage.Prototype.prototype = Annotation.prototype;
InlineImage.prototype = new InlineImage.Prototype();
InlineImage.prototype.constructor = InlineImage;

// Do not fragment this annotation
InlineImage.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(InlineImage);

module.exports = InlineImage;

},{"../../../substance/document":186,"../annotation/annotation":11}],88:[function(require,module,exports){

module.exports = {
  Model: require('./link.js'),
  View: require('./link_view.js')
};

},{"./link.js":89,"./link_view.js":90}],89:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');

var Link = function(node, doc) {
  Annotation.call(this, node, doc);
};

Link.type = {
  id: "link",
  parent: "annotation",
  properties: {
    "url": "string"
  }
};

Link.Prototype = function() {};
Link.Prototype.prototype = Annotation.prototype;
Link.prototype = new Link.Prototype();
Link.prototype.constructor = Link;

// Do not fragment this annotation
Link.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(Link);

module.exports = Link;

},{"../../../substance/document":186,"../annotation/annotation":11}],90:[function(require,module,exports){
var AnnotationView = require('../annotation').View;

var LinkView = function(node) {
  AnnotationView.call(this, node);
};

LinkView.Prototype = function() {

  this.createElement = function() {
    var el = document.createElement('a');
    el.setAttribute('href', this.node.url);
    el.setAttribute("target","_blank");
    return el;
  };

  this.setClasses = function() {
    this.$el.addClass('link');
  };

};
LinkView.Prototype.prototype = AnnotationView.prototype;
LinkView.prototype = new LinkView.Prototype();

module.exports = LinkView;

},{"../annotation":13}],91:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./list"),
  View: require("./list_view")
};

},{"./list":92,"./list_view":93}],92:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var Document = require('../../../substance/document');
var DocumentNode = Document.Node;
var Composite = Document.Composite;

var List = function(node, document) {
  Composite.call(this, node, document);
};

List.type = {
  "id": "list",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "items": ["array", "paragraph"],
    "item_ids": ["array", "integer"],
    "ordered": "boolean",
    "list_type": "string"
  }
};


// This is used for the auto-generated docs
// -----------------
//

List.description = {
  "name": "List",
  "remarks": [
    "Lists can either be numbered or bullet lists"
  ],
  "properties": {
    "ordered": "Specifies wheter the list is ordered or not",
    "items": "An array of paragraph references",
  }
};


// Example Formula
// -----------------
//

List.example = {
  "type": "list",
  "id": "list_1",
  "items ": [
    "paragraph_listitem_1",
    "paragraph_listitem_2",
  ]
};

List.Prototype = function() {

  this.getLength = function() {
    return this.properties.items.length;
  };

  this.getChildrenIds = function() {
    return _.clone(this.items);
  };

  this.getItems = function() {
    return _.map(this.properties.items, function(id) {
      return this.document.get(id);
    }, this);
  };

  this.getChangePosition = function(op) {
    if (op.path[1] === "items") {

      if (op.type === "update") {
        var diff = op.diff;
        if (diff.isInsert()) {
          return op.diff.pos+1;
        }
        else if (diff.isDelete()) {
          return op.diff.pos;
        }
        else if (diff.isMove()) {
          return op.diff.target;
        }
      }
      else if (op.type === "set") {
        return this.properties.items.length-1;
      }
    }

    return -1;
  };

  this.isMutable = function() {
    return true;
  };

  this.insertChild = function(doc, pos, nodeId) {
    doc.update([this.id, "items"], ["+", pos, nodeId]);
  };

  this.deleteChild = function(doc, nodeId) {
    var pos = this.items.indexOf(nodeId);
    doc.update([this.id, "items"], ["-", pos, nodeId]);
    doc.delete(nodeId);
  };

  this.canJoin = function(other) {
    return (other.type === "list");
  };

  this.isBreakable = function() {
    return true;
  };

  this.break = function(doc, childId, charPos) {
    var childPos = this.properties.items.indexOf(childId);
    if (childPos < 0) {
      throw new Error("Unknown child " + childId);
    }
    var child = doc.get(childId);
    var newNode = child.break(doc, charPos);
    doc.update([this.id, "items"], ["+", childPos+1, newNode.id]);
    return newNode;
  };

};

List.Prototype.prototype = Composite.prototype;
List.prototype = new List.Prototype();
List.prototype.constructor = List;

DocumentNode.defineProperties(List.prototype, ["items", "ordered"]);

module.exports = List;

},{"../../../substance/document":186,"underscore":198}],93:[function(require,module,exports){
"use strict";

var CompositeView = require("../composite/composite_view");
var List = require("./list");
var _ = require("underscore");

// Substance.Image.View
// ==========================================================================

var ListView = function (node, viewFactory) {
    CompositeView.call(this, node, viewFactory);
};

ListView.whoami = "SubstanceListView";


ListView.Prototype = function () {

    // Rendering
    // =============================
    //

    this.render = function () {
        this.el.innerHTML = "";
        var list_ordered = (this.node.ordered) ? "OL" : "UL";
        this.content = document.createElement(list_ordered);
        this.content.classList.add("content");

        var ltype = this.node.properties.list_type;
        if (ltype) {
            this.content.classList.add(ltype);
        }

        var i;

        // dispose existing children views if called multiple times
        for (i = 0; i < this.childrenViews.length; i++) {
            this.childrenViews[i].dispose();
        }

        // create children views
        var children = this.node.getNodes();
        var item_ids = this.node.properties.item_ids;


        var lst_id = 0;
        for (i = 0; i < children.length; i++) {
            var child = this.node.document.get(children[i]);
            var childView = this.viewFactory.createView(child);

            var listEl ;

            if (child instanceof List) {
                listEl = childView.render().el;
            } else {
                if (lst_id != item_ids[i] | lst_id ==0 ) {
                    listEl = document.createElement("LI");
                }
                listEl.appendChild(childView.render().el);
            }
            this.content.appendChild(listEl);
            this.childrenViews.push(childView);
            lst_id = item_ids[i];
        }

        this.el.appendChild(this.content);
        return this;
    };

    this.onNodeUpdate = function (op) {
        if (op.path[0] === this.node.id && op.path[1] === "items") {
            this.render();
        }
    };
};

ListView.Prototype.prototype = CompositeView.prototype;
ListView.prototype = new ListView.Prototype();

module.exports = ListView;

},{"../composite/composite_view":35,"./list":92,"underscore":198}],94:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./mixed_citation'),
  View: require('./mixed_citation_view')
};

},{"./mixed_citation":95,"./mixed_citation_view":96}],95:[function(require,module,exports){
var _ = require('underscore');
var Document = require('../../../substance/document');

// Lens.Footnote
// -----------------
//

var MixedCitation = function(node, doc) {
  Document.Node.call(this, node, doc);
};

// Type definition
// -----------------
//

MixedCitation.type = {
  "id": "mixed_citation",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "text": "object",
    "title": "string",
    "label": "string",
    "authors": ["array", "string"],
    "doi": "string",
    "source": "string",
    "volume": "string",
    "citation_type": "string",
    "publisher_name": "string",
    "publisher_location": "string",
    "fpage": "string",
    "lpage": "string",
    "year": "string",
    "comment": "string",
    "citation_urls": ["array", "object"],
    "source_formats": ["array", "object"]
  }
};

// This is used for the auto-generated docs
// -----------------
//

MixedCitation.description = {
  "name": "MixedCitation",
  "remarks": [
    "A journal citation.",
    "This element can be used to describe all kinds of citations."
  ],
  "properties": {
    "title": "The article's title",
    "label": "Optional label (could be a number for instance)",
    "doi": "DOI reference",
    "source": "Usually the journal name",
    "volume": "Issue number",
    "citation_type": "Footnote Type",
    "publisher_name": "Publisher Name",
    "publisher_location": "Publisher Location",
    "fpage": "First page",
    "lpage": "Last page",
    "year": "The year of publication",
    "comment": "Author comment.",
    "citation_urls": "A list of links for accessing the article on the web"
  }
};



// Example Footnote
// -----------------
//

MixedCitation.example = {
  "id": "article_nature08160",
  "type": "article_citation",
  "label": "5",
  "title": "The genome of the blood fluke Schistosoma mansoni",
  "authors": [
    "M Berriman",
    "BJ Haas",
    "PT LoVerde"
  ],
  "citation_type": "Journal Article",
  "doi": "http://dx.doi.org/10.1038/nature08160",
  "source": "Nature",
  "volume": "460",
  "fpage": "352",
  "lpage": "8",
  "year": "1984",
  "comment": "This is a comment.",
  "citation_urls": [
    {
      "name": "PubMed",
      "url": "http://www.ncbi.nlm.nih.gov/pubmed/19606141"
    }
  ]
};


MixedCitation.Prototype = function() {

  // Returns the citation URLs if available
  // Falls back to the DOI url
  // Always returns an array;
  this.urls = function() {
    return this.properties.citation_urls.length > 0 ? this.properties.citation_urls
                                                    : [this.properties.doi];
  };

  this.getHeader = function() {
    return _.compact([this.properties.label, this.properties.citation_type || locales.Reference]).join(' - ');
  };
};

MixedCitation.Prototype.prototype = Document.Node.prototype;
MixedCitation.prototype = new MixedCitation.Prototype();
MixedCitation.prototype.constructor = MixedCitation;

Document.Node.defineProperties(MixedCitation);

module.exports = MixedCitation;

},{"../../../substance/document":186,"underscore":198}],96:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var $$ = require("../../../substance/application").$$;
var NodeView = require("../node").View;
var ResourceView = require('../../resource_view');

// Lens.Citation.View
// ==========================================================================


var MixedCitationView = function (node, viewFactory, options) {
    NodeView.apply(this, arguments);

    // Mix-in
    ResourceView.call(this, options);

};


MixedCitationView.Prototype = function () {

    // Mix-in
    _.extend(this, ResourceView.prototype);

    this.renderBody = function () {
        var frag = document.createDocumentFragment();
        var node = this.node;

        // Add text
        // -------
        //
        var italic, xref;
        var text = node.properties.text[0].nodes;
        if (text !== undefined) {
            for (var i = 0; i < text.length; i++) {
                if (text[i].tagName == 'italic') {
                    italic = document.createElement('span');
                    italic.className = "citation-italic";
                    italic.innerHTML = text[i].innerHTML;
                    frag.appendChild(italic);
                }
                else {
                    if (text[i].tagName == 'ext-link') {
                        xref = document.createElement("a");
                        xref.className = "content-node link";
                        xref.setAttribute("href", text[i]);
                        var href = text[i].getAttributeNodeNS("http://www.w3.org/1999/xlink", "href")
                        if (href) {
                            xref.innerHTML = text[i].innerHTML;
                            xref.setAttribute("href", href.textContent);
                        }
                        xref.setAttribute("target","_blank");

                        frag.appendChild(xref);

                    }
                    else {
                        frag.appendChild(text[i]);
                    }


                }
            }

            this.content.appendChild(frag);
        }
        ;
    };
};

MixedCitationView.Prototype.prototype = NodeView.prototype;
MixedCitationView.prototype = new MixedCitationView.Prototype();
MixedCitationView.prototype.constructor = MixedCitationView;

module.exports = MixedCitationView;

},{"../../../substance/application":173,"../../resource_view":140,"../node":97,"underscore":198}],97:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./node"),
  View: require("./node_view")
};

},{"./node":98,"./node_view":99}],98:[function(require,module,exports){
"use strict";

// Note: we leave the Node in `substance-document` as it is an essential part of the API.
var Document = require('../../../substance/document');

var Node = Document.Node;

// This is used for the auto-generated docs
// -----------------
//

Node.description = {
  "name": "Node",
  "remarks": [
    "Abstract node type."
  ],
  "properties": {
    "source_id": "Useful for document conversion where the original id of an element should be remembered.",
  }
};

// Example
// -------
//

module.exports = Node;

},{"../../../substance/document":186}],99:[function(require,module,exports){
"use strict";

var View = require("../../../substance/application").View;
var TextPropertyView = require("../text/text_property_view");

// Substance.Node.View
// -----------------

var NodeView = function (node, viewFactory, options) {
    View.call(this, options);
    this.node = node;
    this.viewFactory = viewFactory;
    if (!viewFactory) {
        throw new Error('Illegal argument. Argument "viewFactory" is mandatory.');
    }

    this.$el.addClass('content-node').addClass(node.type.replace('_', '-'));
    // content-type handling for paragraph
    this.el.dataset.id = this.node.id;
    if (node.type === 'paragraph') {
        if (node.properties.attributes !== undefined) {
            var attrs = node.properties.attributes;
            if (attrs.length > 0) {
                for (var i = 0; i < attrs.length; i++) {
                    var attr = attrs[i];
                    if (attr.name === 'content-type') {
                        this.$el.addClass(attr.value);
                    }
                }
            }
        }
    }

};

NodeView.Prototype = function() {

  // Rendering
  // --------
  //

  this.render = function() {
    this.content = document.createElement("DIV");
    this.content.classList.add("content");

    this.focusHandle = document.createElement("DIV");
    this.focusHandle.classList.add('focus-handle');

    this.el.appendChild(this.content);
    this.el.appendChild(this.focusHandle);
    return this;
  };

  this.dispose = function() {
    this.stopListening();
  };

  this.createView = function(nodeId) {
    var childNode = this.node.document.get(nodeId);
    var view = this.viewFactory.createView(childNode);
    return view;
  };


  this.createTextView = function(options) {
    console.error('FIXME: NodeView.createTextView() is deprecated. Use NodeView.createTextPropertyView() instead.');
    var view = this.viewFactory.createView(this.node, options, 'text');
    return view;
  };

  this.createTextPropertyView = function(path, options) {
    var view = new TextPropertyView(this.node.document, path, this.viewFactory, options);
    return view;
  };

  this.renderAnnotatedText = function(path, el) {
    var view = TextPropertyView.renderAnnotatedText(this.node.document, path, el, this.viewFactory);
    return view;
  };

};

NodeView.Prototype.prototype = View.prototype;
NodeView.prototype = new NodeView.Prototype();

module.exports = NodeView;

},{"../../../substance/application":173,"../text/text_property_view":131}],100:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./paragraph"),
  View: require("./paragraph_view")
};

},{"./paragraph":101,"./paragraph_view":102}],101:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var Document = require('../../../substance/document');
var DocumentNode = Document.Node;
var Composite = Document.Composite;

var Paragraph = function(node, document) {
  Composite.call(this, node, document);
};

Paragraph.type = {
  "id": "paragraph",
  "parent": "content",
  "properties": {
    "children": ["array", "content"]
  },
   "attributes":"object"

};

// This is used for the auto-generated docs
// -----------------
//

Paragraph.description = {
  "name": "Paragraph",
  "remarks": [
    "A Paragraph can have inline elements such as images."
  ],
  "properties": {
    "children": "An array of content node references",
  }
};

// Example
// -------
//

Paragraph.example = {
  "type": "paragraph",
  "id": "paragraph_1",
  "children ": [
    "text_1",
    "image_1",
    "text_2"
  ]
};

Paragraph.Prototype = function() {

  this.getLength = function() {
    return this.properties.children.length;
  };

  this.getChildrenIds = function() {
    return _.clone(this.properties.children);
  };

  this.getChildren = function() {
    return _.map(this.properties.children, function(id) {
      return this.document.get(id);
    }, this);
  };

};

Paragraph.Prototype.prototype = Composite.prototype;
Paragraph.prototype = new Paragraph.Prototype();
Paragraph.prototype.constructor = Paragraph;

DocumentNode.defineProperties(Paragraph.prototype, ["children"]);

module.exports = Paragraph;

},{"../../../substance/document":186,"underscore":198}],102:[function(require,module,exports){
"use strict";

var CompositeView = require("../composite/composite_view");

// Substance.Paragraph.View
// ==========================================================================

var ParagraphView = function(node, viewFactory) {
  CompositeView.call(this, node, viewFactory);
};

ParagraphView.Prototype = function() {
  
};

ParagraphView.Prototype.prototype = CompositeView.prototype;
ParagraphView.prototype = new ParagraphView.Prototype();

module.exports = ParagraphView;

},{"../composite/composite_view":35}],103:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./publication_info"),
  View: require("./publication_info_view")
};

},{"./publication_info":104,"./publication_info_view":105}],104:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');

var PublicationInfo = function(node, doc) {
  Document.Node.call(this, node, doc);
};

PublicationInfo.type = {
  "id": "publication_info",
  "parent": "content",
  "properties": {
    // history: array of { type: 'string', date: 'string'}
    "history": [ "array", "object" ],
    "published_on": "string",
    "journal": "string",
    "provider": "string",
    "article_type": "string",
    "keywords": ["array", "string"],
    "research_organisms": ["array", "string"],
    "subjects": ["array", "string"],
    "links": ["array", "objects"],
    "doi": "string",
    "related_article": "string",
    "article_info": "paragraph",
    // optional
    "subject_link": "string",
    "article_type_link": "string"
  }
};


PublicationInfo.description = {
  "name": "PublicationInfo",
  "description": "PublicationInfo Node",
  "remarks": [
    "Summarizes the article's meta information. Meant to be customized by publishers"
  ],
  "properties": {
    "received_on": "Submission received",
    "accepted_on": "Paper accepted on",
    "published_on": "Paper published on",
    "history": "History of the submission cycle",
    "journal": "The Journal",
    "provider": "Who is hosting this article",
    "article_type": "Research Article vs. Insight, vs. Correction etc.",
    "keywords": "Article's keywords",
    "research_organisms": "Research Organisms",
    "subjects": "Article Subjects",
    "doi": "Article DOI",
    "related_article": "DOI of related article if there is any"
  }
};


PublicationInfo.example = {
  "id": "publication_info",
  "published_on": "2012-11-13",
  "history": [
    { "type": "received", "date": "2012-06-20" },
    { "type": "accepted", "date": "2012-09-05" }
  ],
  "journal": "eLife",
  "provider": "eLife",
  "article_type": "Research Article",
  "keywords": [
    "innate immunity",
    "histones",
    "lipid droplet",
    "anti-bacterial"
  ],
  "research_organisms": [
    "B. subtilis",
    "D. melanogaster",
    "E. coli",
    "Mouse"
  ],
  "subjects": [
    "Immunology",
    "Microbiology and infectious disease"
  ],
  "doi": "http://dx.doi.org/10.7554/eLife.00003"
};


PublicationInfo.Prototype = function() {

  this.getArticleInfo = function() {
    return this.document.get("articleinfo");
  };

  this.getSubjectLinks = function() {
    return this.subjects.map(function(subject) {
      return {
        name: subject,
        url: this.subject_link + '/' + subject.replace(/ /g, '-').toLowerCase()
      }
    }.bind(this))
  }

  this.getArticleTypeLink = function() {
    return {
      name: this.article_type,
      url: this.article_type_link + '/' + this.article_type.replace(/ /g, '-').toLowerCase()
    }
  }

};

PublicationInfo.Prototype.prototype = Document.Node.prototype;
PublicationInfo.prototype = new PublicationInfo.Prototype();
PublicationInfo.prototype.constructor = PublicationInfo;

Document.Node.defineProperties(PublicationInfo);

module.exports = PublicationInfo;

},{"../../../substance/document":186}],105:[function(require,module,exports){
"use strict";

var NodeView = require("../node").View;
var $$ = require("../../../substance/application").$$;
var articleUtil = require("../../article_util");

var _labels = {
  "received": "received",
  "accepted" : "accepted",
  "revised": "revised",
  "corrected": "corrected",
  "rev-recd": "revised",
  "rev-request": "returned for modification",
  "published": "Published",
  "default": "updated",
};

// Lens.PublicationInfo.View
// ==========================================================================

var PublicationInfoView = function(node, viewFactory) {
  NodeView.call(this, node, viewFactory);

};

PublicationInfoView.Prototype = function() {

  this.render = function() {
    NodeView.prototype.render.call(this);

    // Display article meta information
    // ----------------

    var metaData = $$('.meta-data');


    // Article Type
    //

    if (this.node.article_type) {
      var articleTypeEl = $$('.article-type.container', {
        children: [
          $$('div.label', {text: "Article Type"}),
          $$('div.value', {
            text: this.node.article_type
          })
        ]
      });
      metaData.appendChild(articleTypeEl);
    }

    // Subject
    //

    if (this.node.subjects && this.node.subjects.length > 0) {
      var subjectEl = $$('.subject.container', {
        children: [
          $$('div.label', {text: "Subject"}),
          $$('div.value', {
            text: this.node.subjects.join(', ')
          })
        ]
      });
      metaData.appendChild(subjectEl);
    }

    // Organisms
    //

    if (this.node.research_organisms && this.node.research_organisms.length > 0) {
      var organismsEl = $$('.subject.container', {
        children: [
          $$('div.label', {text: "Organism"}),
          $$('div.value', {
            text: this.node.research_organisms.join(', ')
          })
        ]
      });
      metaData.appendChild(organismsEl);
    }

    // Keywords
    //

    if (this.node.keywords && this.node.keywords.length > 0) {
      var keywordsEl = $$('.keywords.container', {
        children: [
          $$('div.label', {text: "Keywords"}),
          $$('div.value', {
            text: this.node.keywords.join(', ')
          })
        ]
      });
      metaData.appendChild(keywordsEl);
    }

    // DOI
    //

    if (this.node.doi) {
      var doiEl = $$('.doi.container', {
        children: [
          $$('div.label', {text: "DOI"}),
          $$('div.value', {
            children: [$$('a', {href: "https://doi.org/"+this.node.doi, text: this.node.doi, target: '_blank'})]
          })
        ]
      });
      metaData.appendChild(doiEl);
    }

    // Related Article
    //

    if (this.node.related_article) {
      var relatedArticleEl = $$('.related-article.container', {
        children: [
          $$('div.label', {text: "Related Article"}),
          $$('div.value', {
            children: [$$('a', {href: this.node.related_article, text: this.node.related_article})]
          })
        ]
      });
      metaData.appendChild(relatedArticleEl);
    }

    var historyEl = this.describePublicationHistory();

    metaData.appendChild(historyEl);

    this.content.appendChild(metaData);

    // Display article information
    // ----------------

    var articleInfo = this.node.getArticleInfo();

    var articleInfoView = this.viewFactory.createView(articleInfo);
    var articleInfoViewEl = articleInfoView.render().el;
    this.content.appendChild(articleInfoViewEl);

    return this;
  };

  // Creates an element with a narrative description of the publication history

  this.describePublicationHistory = function() {
    var datesEl = $$('.dates');
    var i;

    var dateEntries = [];
    if (this.node.history && this.node.history.length > 0) {
      dateEntries = dateEntries.concat(this.node.history);
    }
    if (this.node.published_on) {
      dateEntries.push({
        type: 'published',
        date: this.node.published_on
      });
    }

    // If there is any pub history, create a narrative following
    // 'The article was ((<action> on <date>, )+ and) <action> on <date>'
    // E.g.,
    // 'This article was published on 11. Oct. 2014'
    // 'This article was accepted on 06.05.2014, and published on 11. Oct. 2014'

    if (dateEntries.length > 0) {
      datesEl.appendChild(document.createTextNode(""));
      for (i = 0; i < dateEntries.length; i++) {
        // conjunction with ', ' or ', and'
        if (i > 0) {
          datesEl.appendChild(document.createTextNode(', '));
          if (i === dateEntries.length-1) {
            datesEl.appendChild(document.createTextNode('and '));
          }
        }
        var entry = dateEntries[i];
        datesEl.appendChild(document.createTextNode((_labels[entry.type] || _labels.default)+ ' on '));
        datesEl.appendChild($$('b', {
          text: articleUtil.formatDate(entry.date)
        }));
      }
      datesEl.appendChild(document.createTextNode('.'));
    }

    return datesEl;
  };

  this.dispose = function() {
    NodeView.prototype.dispose.call(this);
  };
};

PublicationInfoView.Prototype.prototype = NodeView.prototype;
PublicationInfoView.prototype = new PublicationInfoView.Prototype();

module.exports = PublicationInfoView;

},{"../../../substance/application":173,"../../article_util":4,"../node":97}],106:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./quote'),
  View: require('./quote_view')
};

},{"./quote":107,"./quote_view":108}],107:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');
var Composite = Document.Composite;

// Lens.Quote
// -----------------
//

var Quote = function(node, doc) {
  Composite.call(this, node, doc);
};

// Type definition
// -----------------
//

Quote.type = {
  "id": "quote",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "label": "string",
    "children": ["array", "object"]
  }
};

// This is used for the auto-generated docs
// -----------------
//

Quote.description = {
  "name": "Quote",
  "remarks": ["A quote type."],
  "properties": {
    "label": "string",
    "children": "0..n Paragraph nodes"
  }
};


// Example Quote
// -----------------
//

Quote.example = {
  "id": "quote_1",
  "type": "quote",
  "label": "Quote 1",
  "children": ["paragraph_1", "paragraph_2"]
};

Quote.Prototype = function() {

  this.getChildrenIds = function() {
    return this.properties.children;
  };

};

Quote.Prototype.prototype = Composite.prototype;
Quote.prototype = new Quote.Prototype();
Quote.prototype.constructor = Quote;

Document.Node.defineProperties(Quote);

module.exports = Quote;

},{"../../../substance/document":186}],108:[function(require,module,exports){
"use strict";

var NodeView = require('../node').View;
var CompositeView = require("../composite").View;
var $$ = require("../../../substance/application").$$;

// Lens.Quote.View
// ==========================================================================

var QuoteView = function(node, viewFactory) {
    CompositeView.call(this, node, viewFactory);
};

QuoteView.Prototype = function() {

  this.render = function() {
    NodeView.prototype.render.call(this);

    if (this.node.label) {
      var labelEl = $$('.label', {
        text: this.node.label
      });
      this.content.appendChild(labelEl);
    }

    this.renderChildren();
    this.el.appendChild(this.content);
    return this;
  };
};

QuoteView.Prototype.prototype = CompositeView.prototype;
QuoteView.prototype = new QuoteView.Prototype();

module.exports = QuoteView;

},{"../../../substance/application":173,"../composite":36,"../node":97}],109:[function(require,module,exports){

module.exports = {
  Model: require('./resource_reference.js'),
  View: require('./resource_reference_view.js')
};

},{"./resource_reference.js":110,"./resource_reference_view.js":111}],110:[function(require,module,exports){

var Document = require('../../../substance/document');
var Annotation = require('../annotation/annotation');

var ResourceAnnotation = function(node, doc) {
  Annotation.call(this, node, doc);
};

ResourceAnnotation.type = {
  id: "resource_reference",
  parent: "annotation",
  properties: {
    "target": "node"
  }
};

ResourceAnnotation.Prototype = function() {};
ResourceAnnotation.Prototype.prototype = Annotation.prototype;
ResourceAnnotation.prototype = new ResourceAnnotation.Prototype();
ResourceAnnotation.prototype.constructor = ResourceAnnotation;

// Do not fragment this annotation
ResourceAnnotation.fragmentation = Annotation.NEVER;

Document.Node.defineProperties(ResourceAnnotation);

module.exports = ResourceAnnotation;

},{"../../../substance/document":186,"../annotation/annotation":11}],111:[function(require,module,exports){
"use strict";

var AnnotationView = require('../annotation/annotation_view');

var ResourceReferenceView = function(node, viewFactory) {
  AnnotationView.call(this, node, viewFactory);
  this.$el.addClass('resource-reference');
};

ResourceReferenceView.Prototype = function() {
  this.createElement = function() {
    var el = document.createElement('a');
    el.setAttribute('href', '');
    return el;
  };
};
ResourceReferenceView.Prototype.prototype = AnnotationView.prototype;
ResourceReferenceView.prototype = new ResourceReferenceView.Prototype();

module.exports = ResourceReferenceView;

},{"../annotation/annotation_view":12}],112:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./sec_meta'),
  View: require('./sec_meta_view')
};

},{"./sec_meta":113,"./sec_meta_view":114}],113:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var Document = require('../../../substance/document');
var Composite = Document.Composite;

// Lens.Box
// -----------------
//

var secMeta = function(node, doc) {
  Composite.call(this, node, doc);
};

// Type definition
// -----------------
//

secMeta.type = {
  "id": "sec_meta",
  "parent": "content",
  "properties": {
      "children":{
        "abstract":"abstract",

      },
      "authors": ["array", "paragraph"],
      "abstract":["array", "abstract"],
    }


};

// This is used for the auto-generated docs
// -----------------
//

secMeta.description = {
  "name": "Section",
  "remarks": [
    "Sectin Element for metadata",
  ],
  "properties": {
    "children": {
      "abstract": "abstract element"
    }
  }
};


// Example Section Metadata
// -----------------
//

secMeta.example = {
  "id": "sec_meta_1",
  "type": "sec_meta",

  "children": {
      "abstract":"abstract_id"}
};

secMeta.Prototype = function() {

  this.getChildrenIds = function() {
    return this.properties.children;
  };

  this.getAuthors = function() {
        return _.map(this.properties.authors, function(paragraphId) {
            return this.document.get(paragraphId);
        }, this);
    };

    this.getAbstract = function() {
        return _.map(this.properties.abstract, function(paragraphId) {
            return this.document.get(paragraphId);
        }, this);
    };

};

secMeta.Prototype.prototype = Composite.prototype;
secMeta.prototype = new secMeta.Prototype();
secMeta.prototype.constructor = secMeta;

Document.Node.defineProperties(secMeta);

module.exports = secMeta;

},{"../../../substance/document":186,"underscore":198}],114:[function(require,module,exports){
"use strict";
var _ = require("underscore");
var NodeView = require('../node').View;
var CompositeView = require("../composite").View;
var $$ = require("../../../substance/application").$$;

// Lens.SecMeta.View
// ==========================================================================

var secMetaView = function (node, viewFactory) {
    CompositeView.call(this, node, viewFactory);
};

secMetaView.Prototype = function () {
    this.render = function () {
        var node = this.node;
        this.content = document.createElement("div");

        var authors = $$('.authors', {
            children: _.map(node.getAuthors(), function(authorPara) {
                var paraView = this.viewFactory.createView(authorPara);
                var paraEl = paraView.render().el;
                this.content.appendChild(paraEl);
                return paraEl;
            }, this)
        });

        authors.appendChild($$('.content-node.text.plain', {
            children: [
                $$('.content', {text: this.node.document.on_behalf_of})
            ]
        }));
        this.content.appendChild(authors);


        var abstract = $$('.abstract', {
            children: _.map(node.getAbstract(), function(authorPara) {
                var paraView = this.viewFactory.createView(authorPara);
                var paraEl = paraView.render().el;
                this.content.appendChild(paraEl);
                return paraEl;
            }, this)
        });
        this.content.appendChild(abstract);

        this.el.appendChild(this.content);
        return this;
    };
};

secMetaView.Prototype.prototype = CompositeView.prototype;
secMetaView.prototype = new secMetaView.Prototype();

module.exports = secMetaView;

},{"../../../substance/application":173,"../composite":36,"../node":97,"underscore":198}],115:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./speech'),
  View: require('./speech_view')
};

},{"./speech":116,"./speech_view":117}],116:[function(require,module,exports){
"use strict";

var Document = require('../../../substance/document');
var Composite = Document.Composite;

// Lens.Speech
// -----------------
//

var Speech = function(node, doc) {
  Composite.call(this, node, doc);
};

// Type definition
// -----------------
//

Speech.type = {
  "id": "speech",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "label": "string",
    "children": ["array", "paragraph"],
    "speaker":["content"]

  }
};

// This is used for the auto-generated docs
// -----------------
//

Speech.description = {
  "name": "Speech",
  "remarks": [
    "A speech type.",
  ],
  "properties": {
    "label": "string",
    "children": "0..n Paragraph nodes",
  }
};


// Example Speech
// -----------------
//

Speech.example = {
  "id": "speech_1",
  "type": "speech",
  "label": "Speech 1",
  "children": ["paragraph_1", "paragraph_2"]
};

Speech.Prototype = function() {
  this.getChildrenIds = function() {
    return this.properties.children;
  };

};

Speech.Prototype.prototype = Composite.prototype;
Speech.prototype = new Speech.Prototype();
Speech.prototype.constructor = Speech;

Document.Node.defineProperties(Speech);

module.exports = Speech;

},{"../../../substance/document":186}],117:[function(require,module,exports){
"use strict";

var NodeView = require('../node').View;
var CompositeView = require("../composite").View;

var $$ = require("../../../substance/application").$$;


var SpeechView = function (node, viewFactory) {
    CompositeView.call(this, node, viewFactory);
};

SpeechView.Prototype = function () {

    this.render = function () {
        NodeView.prototype.render.call(this);
        var i, htmlTable, tr, td, speaker;

        htmlTable = document.createElement('table');
        htmlTable.setAttribute('class', 'speeches');

        tr = document.createElement('tr');

        var speakers = this.node.speaker;
        for (i = 0; i < speakers.length; i++) {
            td = document.createElement('td');
            td.setAttribute('class', 'speaker');
            td.innerText = speakers[i].textContent;
        }

        tr.appendChild(td)
        var text = this.node.getChildrenIds();
        for (var i = 0; i < text.length; i++) {
            var td = document.createElement('td');
            td.setAttribute('class', 'speech');
            var childView = this.createChildView(text[i]);
            var childViewEl = childView.render().el;
            td.appendChild(childViewEl);
            tr.appendChild(td);

        }

        htmlTable.appendChild(tr);
        this.content.appendChild(htmlTable);

        this.el.appendChild(this.content);
        return this;
    };
};

SpeechView.Prototype.prototype = CompositeView.prototype;
SpeechView.prototype = new SpeechView.Prototype();

module.exports = SpeechView;

},{"../../../substance/application":173,"../composite":36,"../node":97}],118:[function(require,module,exports){

module.exports = {
  Model: require('./strike.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./strike.js":119}],119:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Strike = function(node, doc) {
  Annotation.call(this, node, doc);
};

Strike.type = {
  id: "strike",
  parent: "annotation",
  properties: {}
};

Strike.Prototype = function() {};
Strike.Prototype.prototype = Annotation.prototype;
Strike.prototype = new Strike.Prototype();
Strike.prototype.constructor = Strike;

Strike.fragmentation = Annotation.DONT_CARE;

module.exports = Strike;

},{"../annotation/annotation":11}],120:[function(require,module,exports){

module.exports = {
  Model: require('./strong.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./strong.js":121}],121:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Strong = function(node, doc) {
  Annotation.call(this, node, doc);
};

Strong.type = {
  id: "strong",
  parent: "annotation",
  properties: {}
};

Strong.Prototype = function() {};
Strong.Prototype.prototype = Annotation.prototype;
Strong.prototype = new Strong.Prototype();
Strong.prototype.constructor = Strong;

Strong.fragmentation = Annotation.DONT_CARE;

module.exports = Strong;

},{"../annotation/annotation":11}],122:[function(require,module,exports){

module.exports = {
  Model: require('./subscript.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./subscript.js":123}],123:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Subscript = function(node, doc) {
  Annotation.call(this, node, doc);
};

Subscript.type = {
  id: "subscript",
  parent: "annotation",
  properties: {}
};

Subscript.Prototype = function() {};
Subscript.Prototype.prototype = Annotation.prototype;
Subscript.prototype = new Subscript.Prototype();
Subscript.prototype.constructor = Subscript;

Subscript.fragmentation = Annotation.DONT_CARE;

module.exports = Subscript;

},{"../annotation/annotation":11}],124:[function(require,module,exports){

module.exports = {
  Model: require('./superscript.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./superscript.js":125}],125:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Superscript = function(node, doc) {
  Annotation.call(this, node, doc);
};

Superscript.type = {
  id: "superscript",
  parent: "annotation",
  properties: {}
};

Superscript.Prototype = function() {};
Superscript.Prototype.prototype = Annotation.prototype;
Superscript.prototype = new Superscript.Prototype();
Superscript.prototype.constructor = Superscript;

Superscript.fragmentation = Annotation.DONT_CARE;

module.exports = Superscript;

},{"../annotation/annotation":11}],126:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./supplement'),
  View: require('./supplement_view')
};

},{"./supplement":127,"./supplement_view":128}],127:[function(require,module,exports){
var _ = require('underscore');

var Document = require('../../../substance/document');

// Lens.Supplement
// -----------------
//

var Supplement = function(node, doc) {
  Document.Composite.call(this, node, doc);
};

// Type definition
// -----------------
//

Supplement.type = {
  "id": "supplement",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "label": "string",
    "url": "string",
    "caption": "caption", // contains the doi
  }
};


// This is used for the auto-generated docs
// -----------------
//

Supplement.description = {
  "name": "Supplement",
  "remarks": [
    "A Supplement entity.",
  ],
  "properties": {
    "source_id": "Supplement id as it occurs in the source NLM file",
    "label": "Supplement label",
    "caption": "References a caption node, that has all the content",
    "url": "URL of downloadable file"
  }
};

// Example Supplement
// -----------------
//

Supplement.example = {
  "id": "supplement_1",
  "source_id": "SD1-data",
  "type": "supplement",
  "label": "Supplementary file 1.",
  "url": "http://myserver.com/myfile.pdf",
  "caption": "caption_supplement_1"
};


Supplement.Prototype = function() {

  this.getChildrenIds = function() {
    var nodes = [];
    if (this.properties.caption) {
      nodes.push(this.properties.caption);
    }
    return nodes;
  };

  this.getCaption = function() {
    if (this.properties.caption) {
      return this.document.get(this.properties.caption);
    } else {
      return null;
    }
  };

  this.getHeader = function() {
    return this.properties.label;
  };
};

Supplement.Prototype.prototype = Document.Composite.prototype;
Supplement.prototype = new Supplement.Prototype();
Supplement.prototype.constructor = Supplement;

Document.Node.defineProperties(Supplement);

module.exports = Supplement;

},{"../../../substance/document":186,"underscore":198}],128:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var CompositeView = require("../composite").View;
var $$ = require("../../../substance/application").$$;
var ResourceView = require('../../resource_view');

// Lens.Supplement.View
// ==========================================================================

var SupplementView = function(node, viewFactory, options) {
  CompositeView.call(this, node, viewFactory);

  // Mix-in
  ResourceView.call(this, options);

};

SupplementView.Prototype = function() {

  // Mix-in
  _.extend(this, ResourceView.prototype);

  this.renderBody = function() {

    this.renderChildren();

    var file = $$('div.file', {
      children: [
        $$('a', {href: this.node.url, html: '<i class="fa fa-download"/> Download' })
      ]
    });
    this.content.appendChild(file);
  };
};

SupplementView.Prototype.prototype = CompositeView.prototype;
SupplementView.prototype = new SupplementView.Prototype();
SupplementView.prototype.constructor = SupplementView;

module.exports = SupplementView;

},{"../../../substance/application":173,"../../resource_view":140,"../composite":36,"underscore":198}],129:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./text_node"),
  View: require("./text_view")
};

},{"./text_node":130,"./text_view":132}],130:[function(require,module,exports){
"use strict";

// Note: Text node implementation is a built-in node type which is provided by Substance.Document
var Document = require('../../../substance/document');
module.exports = Document.TextNode;

},{"../../../substance/document":186}],131:[function(require,module,exports){
"use strict";

var util = require("../../../substance/util");

var Fragmenter = util.Fragmenter;
var View = require("../../../substance/application").View;

// Substance.TextPropertyView
// -----------------
//

var TextPropertyView = function(doc, path, viewFactory, options) {
  options = options || {};
  options.elementType = options.elementType || 'span';
  View.call(this, options);

  this.path = path;
  this.document = doc;
  this.viewFactory = viewFactory;
  this.options = options || {};

  this.property = doc.resolve(this.path);
  this.$el.addClass('text');
  if (this.options.classes) {
    this.$el.addClass(this.options.classes);
  }
};

TextPropertyView.Prototype = function() {

  // Rendering
  // =============================
  //

  this.render = function() {
    this.el.innerHTML = "";
    TextPropertyView.renderAnnotatedText(this.document, this.path, this.el, this.viewFactory);
    return this;
  };

  this.dispose = function() {
    this.stopListening();
  };

  this.renderWithAnnotations = function(annotations) {
    var that = this;
    var text = this.property.get();
    var fragment = document.createDocumentFragment();
    var doc = this.document;

    var annotationViews = [];

    // this splits the text and annotations into smaller pieces
    // which is necessary to generate proper HTML.
    var fragmenter = new Fragmenter();
    fragmenter.onText = function(context, text) {
      context.appendChild(document.createTextNode(text));
    };
    fragmenter.onEnter = function(entry, parentContext) {
      var anno = doc.get(entry.id);
      var annotationView = that.viewFactory.createView(anno);
      parentContext.appendChild(annotationView.el);
      annotationViews.push(annotationView);
      return annotationView.el;
    };
    // this calls onText and onEnter in turns...
    fragmenter.start(fragment, text, annotations);

    // allow all annotationViews to (re-)render to allow annotations with custom
    // rendering (e.g., inline-formulas)
    for (var i = 0; i < annotationViews.length; i++) {
      annotationViews[i].render();
    }

    // set the content
    this.el.innerHTML = "";
    this.el.appendChild(fragment);
  };
};

TextPropertyView.Prototype.prototype = View.prototype;
TextPropertyView.prototype = new TextPropertyView.Prototype();

TextPropertyView.renderAnnotatedText = function(doc, path, el, viewFactory) {
  var fragment = window.document.createDocumentFragment();
  var text = doc.get(path);
  var annotations = doc.getIndex("annotations").get(path);
  // this splits the text and annotations into smaller pieces
  // which is necessary to generate proper HTML.
  var annotationViews = [];
  var fragmenter = new Fragmenter();
  fragmenter.onText = function(context, text) {
    context.appendChild(window.document.createTextNode(text));
  };
  fragmenter.onEnter = function(entry, parentContext) {
    var anno = doc.get(entry.id);
    var annotationView = viewFactory.createView(anno);
    parentContext.appendChild(annotationView.el);
    annotationViews.push(annotationView);
    return annotationView.el;
  };
  // this calls onText and onEnter in turns...
  fragmenter.start(fragment, text, annotations);

  // allow all annotationViews to (re-)render to allow annotations with custom
  // rendering (e.g., inline-formulas)
  for (var i = 0; i < annotationViews.length; i++) {
    annotationViews[i].render();
  }
  // set the content
  el.appendChild(fragment);
};

module.exports = TextPropertyView;
},{"../../../substance/application":173,"../../../substance/util":195}],132:[function(require,module,exports){
"use strict";

var util = require("../../../substance/util");
var Fragmenter = util.Fragmenter;
var NodeView = require('../node/node_view');
var $$ = require("../../../substance/application").$$;

// Substance.Text.View
// -----------------
//

var TextView = function(node, viewFactory, options) {
  NodeView.call(this, node, viewFactory);

  options = this.options = options || {};
  this.path = options.path || [ node.id, 'content' ];
  this.property = node.document.resolve(this.path);

  this.$el.addClass('text');

  if (options.classes) {
    this.$el.addClass(options.classes);
  }

  // TODO: it would be better to implement the rendering in a TextPropertyView and
  // make this view a real node view only
  // remove the 'content-node' class if this is used as a property view
  if (options.path) {
    this.$el.removeClass('content-node');
  }

  this._annotations = {};
};

TextView.Prototype = function() {

  // Rendering
  // =============================
  //

  this.render = function() {
    NodeView.prototype.render.call(this);
    this.renderContent();
    return this;
  };

  this.dispose = function() {
    NodeView.prototype.dispose.call(this);
  };

  this.renderContent = function() {
    this.content.innerHTML = "";
    this._annotations = this.node.document.getIndex("annotations").get(this.path);
    this.renderWithAnnotations(this._annotations);

  };

  this.createAnnotationElement = function(entry) {
    if (this.options.createAnnotationElement) {
      return this.options.createAnnotationElement.call(this, entry);
    } else {
      var el;
      if (entry.type === "link") {
        el = $$('a.annotation.'+entry.type, {
          id: entry.id,
          href: this.node.document.get(entry.id).url // "http://zive.at"
        });
      } else {
        el = $$('span.annotation.'+entry.type, {
          id: entry.id
        });
      }
      return el;
    }
  };

  this.renderWithAnnotations = function(annotations) {
    var that = this;
    var text = this.property.get();
    var fragment = document.createDocumentFragment();
    var doc = this.node.document;

    var annotationViews = [];

    // this splits the text and annotations into smaller pieces
    // which is necessary to generate proper HTML.
    var fragmenter = new Fragmenter();
    fragmenter.onText = function(context, text) {
      context.appendChild(document.createTextNode(text));
    };
    fragmenter.onEnter = function(entry, parentContext) {
      var anno = doc.get(entry.id);
      var annotationView = that.viewFactory.createView(anno);
      parentContext.appendChild(annotationView.el);
      annotationViews.push(annotationView);
      return annotationView.el;
    };
    // this calls onText and onEnter in turns...
    fragmenter.start(fragment, text, annotations);

    // allow all annotationViews to (re-)render to allow annotations with custom
    // rendering (e.g., inline-formulas)
    for (var i = 0; i < annotationViews.length; i++) {
      annotationViews[i].render();
    }

    // set the content
    this.content.innerHTML = "";
    this.content.appendChild(fragment);

  };
};

TextView.Prototype.prototype = NodeView.prototype;
TextView.prototype = new TextView.Prototype();

module.exports = TextView;

},{"../../../substance/application":173,"../../../substance/util":195,"../node/node_view":99}],133:[function(require,module,exports){

module.exports = {
  Model: require('./underline.js'),
  View: require('../annotation/annotation_view.js')
};

},{"../annotation/annotation_view.js":12,"./underline.js":134}],134:[function(require,module,exports){

var Annotation = require('../annotation/annotation');

var Underline = function(node, doc) {
  Annotation.call(this, node, doc);
};

Underline.type = {
  id: "underline",
  parent: "annotation",
  properties: {}
};

Underline.Prototype = function() {};
Underline.Prototype.prototype = Annotation.prototype;
Underline.prototype = new Underline.Prototype();
Underline.prototype.constructor = Underline;

Underline.fragmentation = Annotation.DONT_CARE;

module.exports = Underline;

},{"../annotation/annotation":11}],135:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require('./video'),
  View: require('./video_view')
};

},{"./video":136,"./video_view":137}],136:[function(require,module,exports){
var Document = require('../../../substance/document');

// Lens.Video
// -----------------
//

var Video = function(node, doc) {
  Document.Node.call(this, node, doc);
};

// Type definition
// -----------------
//

Video.type = {
  "id": "video",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "label": "string",
    "url": "string",
    "url_webm": "string",
    "url_ogv": "string",
    "caption": "caption",
    "poster": "string"
  }
};

Video.config = {
  "zoomable": true
};

// This is used for the auto-generated docs
// -----------------
//

Video.description = {
  "name": "Video",
  "remarks": [
    "A video type intended to refer to video resources.",
    "MP4, WebM and OGV formats are supported."
  ],
  "properties": {
    "label": "Label shown in the resource header.",
    "url": "URL to mp4 version of the video.",
    "url_webm": "URL to WebM version of the video.",
    "url_ogv": "URL to OGV version of the video.",
    "poster": "Video poster image.",
    "caption": "References a caption node, that has all the content"
  }
};

// Example Video
// -----------------
//

Video.example = {
  "id": "video_1",
  "type": "video",
  "label": "Video 1.",
  "url": "https://cdn.elifesciences.org/video/eLifeLensIntro2.mp4",
  "url_webm": "https://cdn.elifesciences.org/video/eLifeLensIntro2.webm",
  "url_ogv": "https://cdn.elifesciences.org/video/eLifeLensIntro2.ogv",
  "poster": "https://cdn.elifesciences.org/video/eLifeLensIntro2.png",
  // "doi": "http://dx.doi.org/10.7554/Fake.doi.003",
  "caption": "caption_25"
};

Video.Prototype = function() {

  this.getHeader = function() {
    return this.properties.label;
  };

  this.getCaption = function() {
    // HACK: this is not yet a real solution
    if (this.properties.caption) {
      return this.document.get(this.properties.caption);
    } else {
      return "";
    }
  };
    this.includeInToc = function() {
        return false;
    };

};

Video.Prototype.prototype = Document.Node.prototype;
Video.prototype = new Video.Prototype();
Video.prototype.constructor = Video;

Document.Node.defineProperties(Video);

module.exports = Video;

},{"../../../substance/document":186}],137:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var $$ = require("../../../substance/application").$$;
var NodeView = require("../node").View;
var ResourceView = require('../../resource_view');


// Lens.Video.View
// ==========================================================================

var VideoView = function(node, viewFactory, options) {
  NodeView.call(this, node, viewFactory);

  // Mix-in
  ResourceView.call(this, options);

};



VideoView.Prototype = function() {

  // Mix-in
  _.extend(this, ResourceView.prototype);

  this.isZoomable = true;

  this.renderBody = function() {

    // Enrich with video content
    // --------
    //

    var node = this.node;
    //console.log('video node', node);

    // The actual video
    // --------
    //

    var sources = [
      $$('source', {
        src: node.url,
        //type: "video/mp4;",
        //type: "video/mp4; codecs=&quot;avc1.42E01E, mp4a.40.2&quot;",
      })
    ];

    if (node.url_ogv) {
      sources.push($$('source', {
        src: node.url_ogv,
        type: "video/ogg; codecs=&quot;theora, vorbis&quot;",
      }));
    }

    if (node.url_webm) {
      sources.push($$('source', {
        src: node.url_webm,
        type: "video/webm"
      }));
    }

    var video = $$('.video-wrapper', {
      children: [
        $$('video', {
          controls: "controls",
          poster: node.poster,
          preload: "none",
           style: "background-color: black",
          children: sources
        })
      ]
    });

    this.content.appendChild(video);

    // The video title
    // --------
    //

    if (node.title) {
      this.content.appendChild($$('.title', {
        text: node.title
      }));
    }

    // Add caption if there is any
    if (this.node.caption) {
      var caption = this.createView(this.node.caption);
      this.content.appendChild(caption.render().el);
      this.captionView = caption;
    }

    // Add DOI link if available
    // --------
    //
    //  console.log('video', this);

    if (node.doi) {
      this.content.appendChild($$('.doi', {
        children: [
          $$('b', {text: "DOI: "}),
          $$('a', {href: node.doi, target: "_new", text: node.doi})
        ]
      }));
    }
  };

};

VideoView.Prototype.prototype = NodeView.prototype;
VideoView.prototype = new VideoView.Prototype();

module.exports = VideoView;

},{"../../../substance/application":173,"../../resource_view":140,"../node":97,"underscore":198}],138:[function(require,module,exports){
"use strict";

module.exports = {
  Model: require("./web_resource"),
  View: require("../node").View
};

},{"../node":97,"./web_resource":139}],139:[function(require,module,exports){
"use strict";
var Document = require('../../../substance/document');
var DocumentNode = Document.Node;

var WebResource = function(node, doc) {
  DocumentNode.call(this, node, doc);
};

WebResource.type = {
  "id": "webresource",
  "parent": "content",
  "properties": {
    "source_id": "string",
    "url": "string"
  }
};

WebResource.description = {
  "name": "WebResource",
  "description": "A resource which can be accessed via URL",
  "remarks": [
    "This element is a parent for several other nodes such as Image."
  ],
  "properties": {
    "url": "URL to a resource",
  }
};


WebResource.example = {
  "type": "webresource",
  "id": "webresource_3",
  "url": "http://elife.elifesciences.org/content/elife/1/e00311/F3.medium.gif"
};

WebResource.Prototype = function() {};

WebResource.Prototype.prototype = DocumentNode.prototype;
WebResource.prototype = new WebResource.Prototype();
WebResource.prototype.constructor = WebResource;

DocumentNode.defineProperties(WebResource.prototype, ["url"]);

module.exports = WebResource;

},{"../../../substance/document":186}],140:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var NodeView = require("./nodes/node").View;
var $$ = require ("../substance/application").$$;

var DEFAULT_OPTIONS = {
  header: false,
  zoom: false
};

// Note: this is only a mix-in.
// Call this in your Prototype function:
//     _.extend(this, ResourceView.prototype);
//
// You should call the constructor, and make use of `this.renderHeader()` somewhere in the render() implementation

var ResourceView = function(options) {
  this.options = _.extend({}, DEFAULT_OPTIONS, options);
};

ResourceView.Prototype = function() {

  // add this to the prototype so that every class that uses this mixin has this property set
  this.isResourceView = true;

  this.render = function() {
    NodeView.prototype.render.call(this);
    this.renderHeader();
    this.renderBody();
    return this;
  };

  // Rendering
  // =============================
  //

  this.renderHeader = function() {
    var node = this.node;
    if (this.options.header) {
      var headerEl = $$('.resource-header');
      headerEl.appendChild(this.renderLabel());

      var togglesEl = $$('.toggles');

      if (this.options.zoom) {
        togglesEl.appendChild($$('a.toggle.toggle-fullscreen', {
          "href": "#",
          "html": "<i class=\"fa fa-expand\"></i> Fullscreen",
        }));
      }
      togglesEl.appendChild($$('a.toggle-res.toggle.action-toggle-resource', {
        "href": "#",
        "html": "<i class=\"fa fa-eye\"></i> "+locales.Focus
      }));
      headerEl.appendChild(togglesEl);

      this.headerEl = headerEl;
      this.el.insertBefore(headerEl, this.content);
    }
  };

  this.renderLabel = function() {
    var labelEl = $$('div.name', {
      html: this.getHeader(),
    });
    return labelEl;
  };

  this.renderBody = function() {
    
  };

  this.getHeader = function() {
    return this.node.getHeader();
  };
};
ResourceView.prototype = new ResourceView.Prototype();

module.exports = ResourceView;

},{"../substance/application":173,"./nodes/node":97,"underscore":198}],141:[function(require,module,exports){

var ViewFactory = function(nodeTypes, options) {
  this.nodeTypes = nodeTypes;
  this.options = options || {};
};

ViewFactory.Prototype = function() {

  this.getNodeViewClass = function(node, type) {
    type = type || node.type;
    var NodeType = this.nodeTypes[type];
    if (!NodeType) {
      throw new Error('No node registered for type ' + type + '.')
    }
    var NodeView = NodeType.View;
    if (!NodeView) {
      throw new Error('No view registered for type "'+node.type+'".');
    }
    return NodeView;
  };

  this.createView = function(node, options, type) {
    var NodeView = this.getNodeViewClass(node, type);
    // Note: passing the factory to the node views
    // to allow creation of nested views
    var nodeView = new NodeView(node, this, options);
    return nodeView;
  };

};

ViewFactory.prototype = new ViewFactory.Prototype();

module.exports = ViewFactory;

},{}],142:[function(require,module,exports){
"use strict";

// Generic Lens converter
// --------------

var LensConverter = require("./lens_converter");

// Journal-specific implementations
// --------------

module.exports = LensConverter;

},{"./lens_converter":143}],143:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var util = require("../substance/util");
var errors = util.errors;
var ImporterError = errors.define("ImporterError");
var Article = require("../article");

var NlmToLensConverter = function (options) {
    this.options = options || NlmToLensConverter.DefaultOptions;
};

NlmToLensConverter.Prototype = function () {

    this._annotationTypes = {
        "bold": "strong",
        "italic": "emphasis",
        "monospace": "code",
        "sub": "subscript",
        "sup": "superscript",
        "sc": "capitalize",
        "underline": "underline",
        "strike": "strike",
        "ext-link": "link",
        "xref": "",
        "email": "link",
        "named-content": "",
        "inline-formula": "inline-formula",
        "uri": "link"
    };

    // mapping from xref.refType to node type
    this._refTypeMapping = {
        "bibr": "citation_reference",
        "fn": "footnote_reference",
        "fig": "figure_reference",
        "table": "figure_reference",
        "supplementary-material": "figure_reference",
        "other": "figure_reference",
        "list": "definition_reference",
    };

    // mapping of contrib type to human readable names
    // Can be overriden in specialized converter
    this._contribTypeMapping = {
        "author": "Author",
        "author non-byline": "Author",
        "autahor": "Author",
        "auther": "Author",
        "editor": "Editor",
        "guest-editor": "Guest Editor",
        "group-author": "Group Author",
        "collab": "Collaborator",
        "reviewed-by": "Reviewer",
        "nominated-by": "Nominator",
        "corresp": "Corresponding Author",
        "other": "Other",
        "assoc-editor": "Associate Editor",
        "associate editor": "Associate Editor",
        "series-editor": "Series Editor",
        "contributor": "Contributor",
        "chairman": "Chairman",
        "monographs-editor": "Monographs Editor",
        "contrib-author": "Contributing Author",
        "organizer": "Organizer",
        "chair": "Chair",
        "discussant": "Discussant",
        "presenter": "Presenter",
        "guest-issue-editor": "Guest Issue Editor",
        "participant": "Participant",
        "translator": "Translator",
        "section-editor": "Section Editor",
        "section-author": "Section Author"
    };

    this.isAnnotation = function (type) {
        return this._annotationTypes[type] !== undefined;
    };

    this.isParagraphish = function (node) {
        for (var i = 0; i < node.childNodes.length; i++) {
            var el = node.childNodes[i];
            if (el.nodeType !== Node.TEXT_NODE && !this.isAnnotation(el.tagName.toLowerCase())) return false;
        }
        return true;
    };

    this.test = function (xml, documentUrl) {
        /* jshint unused:false */
        return true;
    };

    // Helpers
    // --------

    this.getName = function (nameEl) {
        if (!nameEl) return "N/A";
        var names = [];

        var surnameEl = nameEl.querySelector("surname");
        var givenNamesEl = nameEl.querySelector("given-names");
        var suffix = nameEl.querySelector("suffix");

        if (givenNamesEl) names.push(givenNamesEl.textContent);
        if (surnameEl) names.push(surnameEl.textContent);
        if (suffix) return [names.join(" "), suffix.textContent].join(", ");

        return names.join(" ");
    };

    this.toHtml = function (el) {
        if (!el) return "";
        var tmp = document.createElement("DIV");
        tmp.appendChild(el.cloneNode(true));
        return tmp.innerHTML;
    };

    this.mmlToHtmlString = function (el) {
        var html = this.toHtml(el);
        html = html.replace(/<(\/)?mml:([^>]+)>/g, "<$1$2>");
        return html;
    };

    this.selectDirectChildren = function (scopeEl, selector) {
        // Note: if the ':scope' pseudo class was supported by more browsers
        // it would be the correct selector based solution.
        // However, for now we do simple filtering.
        var result = [];
        var els = scopeEl.querySelectorAll(selector);
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.parentElement === scopeEl) result.push(el);
        }
        return result;
    };

    // ### The main entry point for starting an import

    this.import = function (input) {
        var xmlDoc;

        // Note: when we are using jqueries get("<file>.xml") we
        // magically get a parsed XML document already
        if (_.isString(input)) {
            var parser = new DOMParser();
            xmlDoc = parser.parseFromString(input, "text/xml");
        } else {
            xmlDoc = input;
        }

        this.sanitizeXML(xmlDoc);

        // Creating the output Document via factore, so that it is possible to
        // create specialized NLMImporter later which would want to instantiate
        // a specialized Document type
        var doc = this.createDocument();

        // For debug purposes
        window.doc = doc;

        // A deliverable state which makes this importer stateless
        var state = this.createState(xmlDoc, doc);
        // Note: all other methods are called corresponding
        return this.document(state, xmlDoc);
    };

    // Sometimes we need to deal with unconsistent XML
    // When overwriting this function in your custom converter
    // you can solve those issues in a preprocessing step instead of adding
    // hacks in the main converter code

    this.sanitizeXML = function (xmlDoc) {
        /* jshint unused:false */
    };

    this.createState = function (xmlDoc, doc) {
        return new NlmToLensConverter.State(this, xmlDoc, doc);
    };

    // Overridden to create a Lens Article instance
    this.createDocument = function () {

        var doc = new Article();
        return doc;
    };

    this.show = function (state, nodes) {
        _.each(nodes, function (n) {
            this.showNode(state, n);
        }, this);
    };

    this.extractDate = function (dateEl) {
        if (!dateEl) return null;

        var year = dateEl.querySelector("year");
        var month = dateEl.querySelector("month");
        var day = dateEl.querySelector("day");
        var res = (year !== null ? [year.textContent] : []);
        if (month) res.push(month.textContent);
        if (day) res.push(day.textContent);

        return res.join("-");
    };

    this.extractURLSuffix = function (url) {
        var url = url.replace("https://doi.org/", "");

        return url;
    }

    this.extractPublicationInfo = function (state, article) {
        var doc = state.doc;

        var articleMeta = article.querySelector("article-meta");
        var pubDate = articleMeta.querySelector("pub-date");
        var history = articleMeta.querySelectorAll("history date");

        // Journal title
        //
        var journalTitle = article.querySelector("journal-title");

        // DOI
        //
        // <article-id pub-id-type="doi">10.7554/eLife.00003</article-id>
        var articleDOI = article.querySelector("article-id[pub-id-type=doi]");

        // Related article if exists
        //
        // TODO: can't there be more than one?
        var relatedArticle = article.querySelector("related-article");

        // Article information
        var articleInfo = this.extractArticleInfo(state, article);

        // Create PublicationInfo node
        // ---------------

        var pubInfoNode = {
            "id": "publication_info",
            "type": "publication_info",
            "published_on": this.extractDate(pubDate),
            "journal": journalTitle ? journalTitle.textContent : "",
            "related_article": relatedArticle ? relatedArticle.getAttribute("xlink:href") : "",
            "doi": articleDOI ? this.extractURLSuffix(articleDOI.textContent) : "",
            "article_info": articleInfo.id,
            // TODO: 'article_type' should not be optional; we need to find a good default implementation
            "article_type": "",
            // Optional fields not covered by the default implementation
            // Implement config.enhancePublication() to complement the data
            // TODO: think about how we could provide good default implementations
            "keywords": [],
            "links": [],
            "subjects": [],
            "supplements": [],
            "history": [],
            // TODO: it seems messy to have this in the model
            // Instead it would be cleaner to add 'custom': 'object' field
            "research_organisms": [],
            // TODO: this is in the schema, but seems to be unused
            "provider": "",
        };

        for (var i = 0; i < history.length; i++) {
            var dateEl = history[i];
            var historyEntry = {
                type: dateEl.getAttribute('date-type'),
                date: this.extractDate(dateEl)
            };
            pubInfoNode.history.push(historyEntry);
        }

        doc.create(pubInfoNode);
        doc.show("info", pubInfoNode.id, 0);

        this.enhancePublicationInfo(state, pubInfoNode);
    };

    this.extractArticleInfo = function (state, article) {
        // Initialize the Article Info object
        var articleInfo = {
            "id": "articleinfo",
            "type": "paragraph",
        };
        var doc = state.doc;

        var nodes = [];

        // Reviewing editor
        nodes = nodes.concat(this.extractEditor(state, article));
        // Datasets
        nodes = nodes.concat(this.extractDatasets(state, article));
        // Includes meta information (such as impact statement for eLife)
        nodes = nodes.concat(this.extractCustomMetaGroup(state, article));
        // Acknowledgments
        nodes = nodes.concat(this.extractAcknowledgements(state, article));
        // License and Copyright
        nodes = nodes.concat(this.extractCopyrightAndLicense(state, article));
        // Notes (Footnotes + Author notes)
        nodes = nodes.concat(this.extractNotes(state, article));

        articleInfo.children = nodes;
        doc.create(articleInfo);

        return articleInfo;
    };

    // Get reviewing editor
    // --------------
    // TODO: it is possible to have multiple editors. This does only show the first one
    //   However, this would be easy: just querySelectorAll and have 'Reviewing Editors' as heading when there are multiple nodes found

    this.extractEditor = function (state, article) {
        var nodes = [];
        var doc = state.doc;

        var editor = article.querySelector("contrib[contrib-type=editor]");
        if (editor) {
            var content = [];

            var name = this.getName(editor.querySelector('name'));
            if (name) content.push(name);
            var inst = editor.querySelector("institution");
            if (inst) content.push(inst.textContent);
            var country = editor.querySelector("country");
            if (country) content.push(country.textContent);

            var h1 = {
                "type": "heading",
                "id": state.nextId("heading"),
                "level": 3,
                "content": "Reviewing Editor"
            };

            //doc.create(h1);
            //nodes.push(h1.id);

            var t1 = {
                "type": "text",
                "id": state.nextId("text"),
                "content": content.join(", ")
            };
            //TODO reviewing editor
            //doc.create(t1);
            //nodes.push(t1.id);
        }
        return nodes;
    };

    //
    // Extracts major datasets
    // -----------------------

    this.extractDatasets = function (state, article) {
        var nodes = [];
        var doc = state.doc;

        var datasets = article.querySelectorAll('sec');
        for (var i = 0; i < datasets.length; i++) {
            var data = datasets[i];
            var type = data.getAttribute('sec-type');
            if (type === 'datasets') {
                var h1 = {
                    "type": "heading",
                    "id": state.nextId("heading"),
                    "level": 3,
                    "content": "Major Datasets"
                };
                doc.create(h1);
                nodes.push(h1.id);
                var ids = this.datasets(state, util.dom.getChildren(data));
                for (var j = 0; j < ids.length; j++) {
                    if (ids[j]) {
                        nodes.push(ids[j]);
                    }
                }
            }
        }
        return nodes;
    };

    var _capitalized = function (str, all) {
        if (all) {
            return str.split(' ').map(function (s) {
                return _capitalized(s);
            }).join(' ');
        } else {
            return str.charAt(0).toUpperCase() + str.slice(1);
        }
    };

    this.capitalized = function (str, all) {
        return _capitalized(str, all);
    };

    //
    // Extracts Acknowledgements
    // -------------------------

    this.extractAcknowledgements = function (state, article) {
        var nodes = [];
        var doc = state.doc;

        var acks = article.querySelectorAll("ack");
        if (acks && acks.length > 0) {
            _.each(acks, function (ack) {
                var title = ack.querySelector('title');
                var header = {
                    "type": "heading",
                    "id": state.nextId("heading"),
                    "level": 3,
                    "content": title ? this.capitalized(title.textContent.toLowerCase(), "all") : "Acknowledgements"
                };
                doc.create(header);
                nodes.push(header.id);

                // There may be multiple paragraphs per ack element
                var pars = this.bodyNodes(state, util.dom.getChildren(ack), {
                    ignore: ["title"]
                });
                _.each(pars, function (par) {
                    nodes.push(par.id);
                });
            }, this);
        }

        return nodes;
    };

    //
    // Extracts footnotes that should be shown in article info
    // ------------------------------------------
    //
    // Needs to be overwritten in configuration

    this.extractNotes = function (/*state, article*/) {
        var nodes = [];
        return nodes;
    };

    // Can be overridden by custom converter to ignore <meta-name> values.
    // TODO: Maybe switch to a whitelisting approach, so we don't show
    // nonsense. See HighWire implementation
    this.__ignoreCustomMetaNames = [];

    this.extractCustomMetaGroup = function (state, article) {
        var nodeIds = [];
        var doc = state.doc;

        var customMetaEls = article.querySelectorAll('article-meta-group custom-meta');
        if (customMetaEls.length === 0) return nodeIds;

        for (var i = 0; i < customMetaEls.length; i++) {
            var customMetaEl = customMetaEls[i];

            var metaNameEl = customMetaEl.querySelector('meta-name');
            var metaValueEl = customMetaEl.querySelector('meta-value');

            if (!_.include(this.__ignoreCustomMetaNames, metaNameEl.textContent)) {
                var header = {
                    "type": "heading",
                    "id": state.nextId("heading"),
                    "level": 3,
                    "content": ""
                };
                header.content = this.annotatedText(state, metaNameEl, [header.id, 'content']);

                doc.create(header);
                var bodyNodes = this.paragraphGroup(state, metaValueEl);

                nodeIds.push(header.id);
                nodeIds = nodeIds.concat(_.pluck(bodyNodes, 'id'));
            }
        }
        return nodeIds;
    };

    //
    // Extracts Copyright and License Information
    // ------------------------------------------

    this.extractCopyrightAndLicense = function (state, article) {
        var nodes = [];
        var doc = state.doc;

        var license = article.querySelector("permissions");
        if (license) {
            var h1 = {
                "type": "heading",
                "id": state.nextId("heading"),
                "level": 3,
                "content": "Copyright & License"
            };
            doc.create(h1);
            nodes.push(h1.id);

            // TODO: this is quite messy. We should introduce a dedicated note for article info
            // and do that rendering related things there, e.g., '. ' separator

            var par;
            var copyright = license.querySelector("copyright-statement");
            if (copyright) {
                par = this.paragraphGroup(state, copyright);
                if (par && par.length) {
                    nodes = nodes.concat(_.map(par, function (p) {
                        return p.id;
                    }));
                    // append '.' only if there is none yet
                    if (copyright.textContent.trim().slice(-1) !== '.') {
                        // TODO: this needs to be more robust... what if there are no children
                        var textid = _.last(_.last(par).children);
                        doc.nodes[textid].content += ". ";
                    }
                }
            }
            var i;
            var lic = license.querySelectorAll("license");
            for (i = 0; i < lic.length; i++) {
                if (lic[i].length == 1 || lic[i].getAttribute("xml:lang") == "en") {
                    if (lic[i]) {
                        for (var child = lic[i].firstElementChild; child; child = child.nextElementSibling) {
                            var type = util.dom.getNodeType(child);
                            if (type === 'p' || type === 'license-p') {
                                par = this.paragraphGroup(state, child);
                                if (par && par.length) {
                                    nodes = nodes.concat(_.pluck(par, 'id'));
                                }
                            }
                        }
                    }
                }
            }
        }

        return nodes;
    };

    this.extractCover = function (state, article) {
        var doc = state.doc;
        var docNode = doc.get("document");
        var articleMeta = article.querySelector("article-meta");
        var abstract = this._abstract(state, articleMeta);
        var a_id = '';
        if (abstract !== undefined) {
            a_id = abstract.id
        }

        var cover = {
            id: "cover",
            type: "cover",
            title: docNode.title,
            authors: [],
            abstract: a_id
        };


        // Create authors paragraph that has contributor_reference annotations
        // to activate the author cards

        _.each(docNode.authors, function (contributorId) {
            var contributor = doc.get(contributorId);

            var authorsPara = {
                "id": "text_" + contributorId + "_reference",
                "type": "text",
                "content": contributor.name
            };

            doc.create(authorsPara);
            cover.authors.push(authorsPara.id);

            var anno = {
                id: state.nextId("contributor_reference"),
                type: "contributor_reference",
                path: ["text_" + contributorId + "_reference", "content"],
                range: [0, contributor.name.length],
                target: contributorId
            };

            doc.create(anno);
        }, this);

        // Move to elife configuration
        // -------------------
        // <article-categories>
        // <subj-group subj-group-type="display-channel">...</subj-group>
        // <subj-group subj-group-type="heading">...</subj-group>
        // </article-categories>

        // <article-categories>
        //   <subj-group subj-group-type="display-channel">
        //     <subject>Research article</subject>
        //   </subj-group>
        //   <subj-group subj-group-type="heading">
        //     <subject>Biophysics and structural biology</subject>
        //   </subj-group>
        // </article-categories>

        this.enhanceCover(state, cover, article);

        doc.create(cover);
        doc.show("content", cover.id, 0);
    };

    // Note: Substance.Article supports only one author.
    // We use the first author found in the contribGroup for the 'creator' property.
    this.contribGroup = function (state, contribGroup) {
        var i;
        var contribGrp = [];
        var contribs = contribGroup.querySelectorAll("contrib");
        for (i = 0; i < contribs.length; i++) {
            var c = this.contributor(state, contribs[i]);
            contribGrp.push(c);
        }
        // Extract on-behalf-of element and stick it to the document
        var doc = state.doc;
        var onBehalfOf = contribGroup.querySelector("on-behalf-of");
        if (onBehalfOf) doc.on_behalf_of = onBehalfOf.textContent.trim();
        return contribGrp;
    };

    this.affiliation = function (state, aff) {
        var doc = state.doc;

        var institution = aff.querySelector("institution");
        var country = aff.querySelector("country");
        var label = aff.querySelector("label");
        var department = aff.querySelector("addr-line named-content[content-type=department]");
        var city = aff.querySelector("addr-line named-content[content-type=city]");

        // TODO: this is a potential place for implementing a catch-bin
        // For that, iterate all children elements and fill into properties as needed or add content to the catch-bin

        var affiliationNode = {
            id: state.nextId("affiliation"),
            type: "affiliation",
            source_id: aff.getAttribute("id"),
            label: label ? label.textContent : null,
            department: department ? department.textContent : null,
            city: city ? city.textContent : null,
            institution: institution ? institution.textContent : null,
            country: country ? country.textContent : null
        };
        doc.create(affiliationNode);
    };

    this.contributor = function (state, contrib) {
        var doc = state.doc;

        var id = state.nextId("contributor");
        var contribNode = {
            id: id,
            source_id: contrib.getAttribute("id"),
            type: "contributor",
            name: "",
            affiliations: [],
            fundings: [],
            bio: [],

            // Not yet supported... need examples
            image: "",
            deceased: false,
            emails: [],
            contribution: "",
            members: []
        };

        // Extract contrib type
        var contribType = contrib.getAttribute("contrib-type");

        // Assign human readable version
        contribNode["contributor_type"] = this._contribTypeMapping[contribType];

        // Extract role
        var role = contrib.querySelector("role");
        if (role) {
            contribNode["role"] = role.textContent;
        }

        // Search for author bio and author image
        var bio = contrib.querySelector("bio");
        if (bio) {
            _.each(util.dom.getChildren(bio), function (par) {
                var graphic = par.querySelector("graphic");
                if (graphic) {
                    var imageUrl = graphic.getAttribute("xlink:href");
                    contribNode.image = imageUrl;
                } else {
                    var pars = this.paragraphGroup(state, par);
                    if (pars.length > 0) {
                        contribNode.bio = [pars[0].id];
                    }
                }
            }, this);
        }

        // Deceased?

        if (contrib.getAttribute("deceased") === "yes") {
            contribNode.deceased = true;
        }

        // Extract ORCID
        // -----------------
        //
        // <uri content-type="orcid" xlink:href="http://orcid.org/0000-0002-7361-560X"/>

        var orcidURI = contrib.querySelector("uri[content-type=orcid]");
        if (orcidURI) {
            contribNode.orcid = orcidURI.getAttribute("xlink:href");
        }

        // Extracting equal contributions
        var nameEl = contrib.querySelector("name");
        if (nameEl) {
            contribNode.name = this.getName(nameEl);
        } else {
            var collab = contrib.querySelector("collab");
            // Assuming this is an author group
            if (collab) {
                contribNode.name = collab.textContent;
            } else {
                contribNode.name = "N/A";
            }
        }

        this.extractContributorProperties(state, contrib, contribNode);


        // HACK: for cases where no explicit xrefs are given per
        // contributor we assin all available affiliations
        if (contribNode.affiliations.length === 0) {
            contribNode.affiliations = state.affiliations;
        }

        // HACK: if author is assigned a conflict, remove the redundant
        // conflict entry "The authors have no competing interests to declare"
        // This is a data-modelling problem on the end of our input XML
        // so we need to be smart about it in the converter
        if (contribNode.competing_interests.length > 1) {
            contribNode.competing_interests = _.filter(contribNode.competing_interests, function (confl) {
                return confl.indexOf("no competing") < 0;
            });
        }

        if (contrib.getAttribute("contrib-type") === "author") {
            doc.nodes.document.authors.push(id);
        }
        if (contrib.getAttribute("contrib-type") === "editor") {
            doc.nodes.document.authors.push(id);
        }
        if (contrib.getAttribute("contrib-type") === "section-editor") {
            doc.nodes.document.authors.push(id);
        }
        if (contrib.getAttribute("contrib-type") === "section-author") {
            doc.nodes.document.authors.push(id);
        }

        doc.create(contribNode);
        doc.show("info", contribNode.id);
        return contribNode;
    };

    this._getEqualContribs = function (state, contrib, contribId) {
        var result = [];
        var refs = state.xmlDoc.querySelectorAll("xref[rid=" + contribId + "]");
        // Find xrefs within contrib elements
        _.each(refs, function (ref) {
            var c = ref.parentNode;
            if (c !== contrib) result.push(this.getName(c.querySelector("name")));
        }, this);
        return result;
    };

    this.extractContributorProperties = function (state, contrib, contribNode) {
        var doc = state.doc;

        // Extract equal contributors
        var equalContribs = [];
        var compInterests = [];

        // extract affiliations stored as xrefs
        var xrefs = contrib.querySelectorAll("xref");
        _.each(xrefs, function (xref) {
            if (xref.getAttribute("ref-type") === "aff") {
                var affId = xref.getAttribute("rid");
                var affNode = doc.getNodeBySourceId(affId);
                if (affNode) {
                    contribNode.affiliations.push(affNode.id);
                    state.used[affId] = true;
                }
            } else if (xref.getAttribute("ref-type") === "other") {
                // FIXME: it seems *very* custom to interprete every 'other' that way
                // TODO: try to find and document when this is applied
                console.log("FIXME: please add documentation about using 'other' as indicator for extracting an awardGroup.");

                var awardGroup = state.xmlDoc.getElementById(xref.getAttribute("rid"));
                if (!awardGroup) return;
                var fundingSource = awardGroup.querySelector("funding-source");
                if (!fundingSource) return;
                var awardId = awardGroup.querySelector("award-id");
                awardId = awardId ? ", " + awardId.textContent : "";
                // Funding source nodes are looking like this
                //
                // <funding-source>
                //   National Institutes of Health
                //   <named-content content-type="funder-id">http://dx.doi.org/10.13039/100000002</named-content>
                // </funding-source>
                //
                // and we only want to display the first text node, excluding the funder id
                var fundingSourceName = fundingSource.childNodes[0].textContent;
                contribNode.fundings.push([fundingSourceName, awardId].join(''));
            } else if (xref.getAttribute("ref-type") === "corresp") {
                var correspId = xref.getAttribute("rid");
                var corresp = state.xmlDoc.getElementById(correspId);
                if (!corresp) return;
                // TODO: a corresp element allows *much* more than just an email
                // Thus, we are leaving this like untouched, so that it may be grabbed by extractAuthorNotes()
                // state.used[correspId] = true;
                var email = corresp.querySelector("email");
                if (!email) return;
                contribNode.emails.push(email.textContent);
            } else if (xref.getAttribute("ref-type") === "fn") {
                var fnId = xref.getAttribute("rid");
                var fnElem = state.xmlDoc.getElementById(fnId);
                var used = true;
                if (fnElem) {
                    var fnType = fnElem.getAttribute("fn-type");
                    switch (fnType) {
                        case "con":
                            contribNode.contribution = fnElem.textContent;
                            break;
                        case "conflict":
                            compInterests.push(fnElem.textContent.trim());
                            break;
                        case "present-address":
                            contribNode.present_address = fnElem.querySelector("p").textContent;
                            break;
                        case "equal":
                            console.log("FIXME: isn't fnElem.getAttribute(id) === fnId?");
                            equalContribs = this._getEqualContribs(state, contrib, fnElem.getAttribute("id"));
                            break;
                        case "other":
                            // HACK: sometimes equal contribs are encoded as 'other' plus special id
                            console.log("FIXME: isn't fnElem.getAttribute(id) === fnId?");
                            if (fnElem.getAttribute("id").indexOf("equal-contrib") >= 0) {
                                equalContribs = this._getEqualContribs(state, contrib, fnElem.getAttribute("id"));
                            } else {
                                used = false;
                            }
                            break;
                        default:
                            used = false;
                    }
                    if (used) state.used[fnId] = true;
                }
            } else {
                // TODO: this is a potential place for implementing a catch-bin
                // For that, we could push the content of the referenced element into the contrib's catch-bin
                console.log("Skipping contrib's xref", xref.textContent);
            }
        }, this);

        // Extract member list for person group
        // eLife specific?
        // ----------------

        if (compInterests.length > 1) {
            compInterests = _.filter(compInterests, function (confl) {
                return confl.indexOf("no competing") < 0;
            });
        }

        contribNode.competing_interests = compInterests;
        var memberList = contrib.querySelector("xref[ref-type=other]");

        if (memberList) {
            var memberListId = memberList.getAttribute("rid");
            var members = state.xmlDoc.querySelectorAll("#" + memberListId + " contrib");
            contribNode.members = _.map(members, function (m) {
                return this.getName(m.querySelector("name"));
            }, this);
        }

        contribNode.equal_contrib = equalContribs;
        contribNode.competing_interests = compInterests;
    };

    // Parser
    // --------
    // These methods are used to process XML elements in
    // using a recursive-descent approach.


    // ### Top-Level function that takes a full NLM tree
    // Note: a specialized converter can derive this method and
    // add additional pre- or post-processing.

    this.document = function (state, xmlDoc) {
        var doc = state.doc;
        var article = xmlDoc.querySelector("article");
        if (!article) {
            throw new ImporterError("Expected to find an 'article' element.");
        }
        // recursive-descent for the main body of the article
        this.article(state, article);
        this.postProcess(state);
        // Rebuild views to ensure consistency
        _.each(doc.containers, function (container) {
            container.rebuild();
        });
        return doc;
    };

    this.postProcess = function (state) {
        this.postProcessAnnotations(state);
    };

    this.postProcessAnnotations = function (state) {
        // Creating the annotations afterwards, to make sure
        // that all referenced nodes are available
        for (var i = 0; i < state.annotations.length; i++) {
            var anno = state.annotations[i];
            if (anno.target) {
                var targetNode = state.doc.getNodeBySourceId(anno.target);
                if (targetNode) {
                    anno.target = targetNode.id;
                } else {
                    // NOTE: I've made this silent because it frequently occurs that no targetnode is
                    // available (e.g. for inline formulas)
                    console.log("Could not lookup targetNode for annotation", anno);
                }
            }
            state.doc.create(state.annotations[i]);
        }
    };

    // Article
    // --------
    // Does the actual conversion.
    //
    // Note: this is implemented as lazy as possible (ALAP) and will be extended as demands arise.
    //
    // If you need such an element supported:
    //  - add a stub to this class (empty body),
    //  - add code to call the method to the appropriate function,
    //  - and implement the handler here if it can be done in general way
    //    or in your specialized importer.

    this.article = function (state, article) {
        var doc = state.doc;

        // Assign id
        var articleId = article.querySelector("article-id");
        // Note: Substance.Article does only support one id
        if (articleId) {
            doc.id = articleId.textContent;
        } else {
            // if no id was set we create a random one
            doc.id = util.uuid();
        }

        // Extract glossary
        this.extractDefinitions(state, article);

        // Extract authors etc.
        this.extractAffilitations(state, article);
        this.extractContributors(state, article);

        // Same for the citations, also globally
        this.extractCitations(state, article);
        // Same for the citations, also globally


        // Make up a cover node
        this.extractCover(state, article);

        // Extract ArticleMeta
        this.extractArticleMeta(state, article);


        // Populate Publication Info node
        this.extractPublicationInfo(state, article);


        var body = article.querySelector("body");
        if (body) {
            this.body(state, body);
        }

        this.extractFigures(state, article);

        this.enhanceArticle(state, article);

        //Extact Footnotes
        this.extractFootnotes(state, article);


    };

    this.extractDefinitions = function (state /*, article*/) {
        var defItems = state.xmlDoc.querySelectorAll("def-item");

        _.each(defItems, function (defItem) {
            var term = defItem.querySelector("term");
            var def = defItem.querySelector("def");

            // using hwp:id as a fallback MCP articles don't have def.id set
            var id = def.id || def.getAttribute("hwp:id") || state.nextId('definition');

            var definitionNode = {
                id: id,
                type: "definition",
                title: term.textContent,
                description: def.textContent
            };

            state.doc.create(definitionNode);
            state.doc.show("definitions", definitionNode.id);
        });
    };


    // #### Front.ArticleMeta
    //

    this.extractArticleMeta = function (state, article) {
        var articleMeta = article.querySelector("article-meta");
        if (!articleMeta) {
            throw new ImporterError("Expected element: 'article-meta'");
        }

        // <article-id> Article Identifier, zero or more
        var articleIds = articleMeta.querySelectorAll("article-id");
        this.articleIds(state, articleIds);

        // <title-group> Title Group, zero or one
        var titleGroup = articleMeta.querySelector("title-group");
        if (titleGroup) {
            this.titleGroup(state, titleGroup);
        }

        // <pub-date> Publication Date, zero or more
        var pubDates = articleMeta.querySelectorAll("pub-date");
        this.pubDates(state, pubDates);
        //this.abstracts(state, articleMeta);


        // Not supported yet:
        // <trans-abstract> Translated Abstract, zero or more
        // <kwd-group> Keyword Group, zero or more
        // <conference> Conference Information, zero or more
        // <counts> Counts, zero or one
        // <custom-meta-group> Custom Metadata Group, zero or one
    };

    this.extractAffilitations = function (state, article) {
        var affiliations = article.querySelectorAll("aff");
        for (var i = 0; i < affiliations.length; i++) {
            this.affiliation(state, affiliations[i]);
        }
    };

    this.extractContributors = function (state, article) {
        // TODO: the spec says, that there may be any combination of
        // 'contrib-group', 'aff', 'aff-alternatives', and 'x'
        // However, in the articles seen so far, these were sub-elements of 'contrib-group', which itself was single
        var contribGroup = article.querySelector("contrib-group");
        if (contribGroup) {
            this.contribGroup(state, contribGroup);
        }


    };

    // Catch-all implementation for figures et al.
    this.extractFigures = function (state, xmlDoc) {
        // Globally query all figure-ish content, <fig>, <supplementary-material>, <table-wrap>, <media video>
        // mimetype="video"
        var body = xmlDoc.querySelector("body");
        var figureElements = body.querySelectorAll("fig, table-wrap, supplementary-material, media[mimetype=video], media[mimetype=audio]");
        var nodes = [];
        for (var i = 0; i < figureElements.length; i++) {
            var figEl = figureElements[i];
            // skip converted elements
            if (figEl._converted) continue;
            var type = util.dom.getNodeType(figEl);
            var node = null;
            if (type === "fig") {
                node = this.figure(state, figEl);
            }
            //else if (type === "table-wrap") {
            //    node = this.tableWrap(state, figEl)};
            else if (type === "media") {
                node = this.video(state, figEl);
            }
            else if (type === "supplementary-material") {
                node = this.supplement(state, figEl);
            }
            if (node) {
                nodes.push(node);
            }
        }
        this.show(state, nodes);
    };

    this.extractCitations = function (state, xmlDoc) {
        var refList = xmlDoc.querySelector("ref-list");
        if (refList) {
            this.refList(state, refList);
        }
    };

    this.extractFootnotes = function (state, xmlDoc) {
        var fnList = xmlDoc.querySelector("fn-group");
        if (fnList) {
            this.fnList(state, fnList);
        }
    };


    // articleIds: array of <article-id> elements
    this.articleIds = function (state, articleIds) {
        var doc = state.doc;

        // Note: Substance.Article does only support one id
        if (articleIds.length > 0) {
            doc.id = articleIds[0].textContent;
        } else {
            // if no id was set we create a random one
            doc.id = util.uuid();
        }
    };

    this.titleGroup = function (state, titleGroup) {
        var doc = state.doc;
        var articleTitle = titleGroup.querySelector("article-title");
        if (articleTitle) {
            doc.title = this.annotatedText(state, articleTitle, ['document', 'title'], {
                ignore: ['xref']
            });
        }
        // Not yet supported:
        // <subtitle> Document Subtitle, zero or one
    };

    // Note: Substance.Article supports no publications directly.
    // We use the first pub-date for created_at
    this.pubDates = function (state, pubDates) {
        var doc = state.doc;
        if (pubDates.length > 0) {
            var converted = this.pubDate(state, pubDates[0]);
            doc.created_at = converted.date;
        }
    };

    // Note: this does not follow the spec but only takes the parts as it was necessary until now
    // TODO: implement it thoroughly
    this.pubDate = function (state, pubDate) {
        var day = -1;
        var month = -1;
        var year = -1;
        _.each(util.dom.getChildren(pubDate), function (el) {
            var type = util.dom.getNodeType(el);

            var value = el.textContent;
            if (type === "day") {
                day = parseInt(value, 10);

            } else if (type === "month") {
                month = parseInt(value, 10);
            } else if (type === "year") {
                year = parseInt(value, 10);
            }
        }, this);
        var date = new Date(year, month, day);
        return {
            date: date
        };
    };

    this.abstracts = function (state, articleMeta) {
        // <abstract> Abstract, zero or more
        var abstracts = articleMeta.querySelectorAll("abstract");
        _.each(abstracts, function (abs) {
            this._abstract(state, abs);
        }, this);
    };

    this._abstract = function (state, abs) {
        var title = abs.querySelector("title");

        var doc = state.doc;
        var abstractNode = {
            id: state.nextId("abstract"),
            type: "abstract",
            label: "",
            title: "",
            children: []
        }
        if (title !== null) {
            if (title.textContent.length > 0) {
                var iterator = new util.dom.ChildNodeIterator(title);
                while (iterator.hasNext()) {
                    var child = iterator.next();
                    var type = util.dom.getNodeType(child);

                    // annotated text node
                    if (type === "text" || this.isAnnotation(type)) {
                        var textNode = {
                            id: state.nextId("text"),
                            type: "text",
                            content: null
                        };
                    }
                }
                // pushing information to the stack so that annotations can be created appropriately
                state.stack.push({
                    path: [textNode.id, "content"]
                });

                var annotatedText = this._annotatedText(state, iterator.back(), {offset: 0, breakOnUnknown: true});

                // Ignore empty paragraphs
                if (annotatedText.length > 0) {
                    textNode.content = annotatedText;
                    doc.create(textNode);
                    //nodes.push(textNode);
                }
                abstractNode.title = textNode.id;
            }
            else {
            }
        }
        else {
        }

        var children = [];
        var paragraphs = abs.querySelectorAll("p");
        _.each(paragraphs, function (p) {

            //if (p.parentNode !== abs) return;
            var node = this.paragraph(state, p);
            if (node) children.push(node.id);
        }, this);
        abstractNode.children = children;
        doc.create(abstractNode);
        return abstractNode;


    };

    // ### Article.Body
    //

    this.body = function (state, body) {
        var doc = state.doc;
        //TODO removed content: "Main Text" and added content:''
        var heading = {
            id: state.nextId("heading"),
            type: "heading",
            level: 1,
            content: ""
        };


        doc.create(heading);
        var nodes = [heading].concat(this.bodyNodes(state, util.dom.getChildren(body)));
        if (nodes.length > 0) {
            this.show(state, nodes);
        }
    };

    this._ignoredBodyNodes = {
        // figures and table-wraps are treated globally
        "fig": true,
        "table": true,
        "speaker": true

    };

    // Top-level elements as they can be found in the body or
    // in a section
    // Note: this is also used for boxed-text elements
    this._bodyNodes = {};

    this.bodyNodes = function (state, children, options) {
        var nodes = [], node;

        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var type = util.dom.getNodeType(child);

            if (this._bodyNodes[type]) {
                var result = this._bodyNodes[type].call(this, state, child);
                if (_.isArray(result)) {
                    nodes = nodes.concat(result);
                } else if (result) {
                    nodes.push(result);
                } else {

                }
            } else if (this._ignoredBodyNodes[type] || (options && options.ignore && options.ignore.indexOf(type) >= 0)) {
                // Note: here are some node types ignored which are
                // processed in an extra pass (figures, tables, etc.)
                node = this.ignoredNode(state, child, type);
                if (node) nodes.push(node);
            } else {
                console.error("Node not yet supported as top-level node: " + type);
            }
        }
        return nodes;
    };

    this._bodyNodes["p"] = function (state, child) {
        return this.paragraphGroup(state, child);
    };

    this._bodyNodes["sec"] = function (state, child) {
        return this.section(state, child);
    };
    this._bodyNodes["list"] = function (state, child) {
        return this.list(state, child);
    };
    this._bodyNodes["disp-formula"] = function (state, child) {
        return this.formula(state, child);
    };
    this._bodyNodes["caption"] = function (state, child) {
        return this.caption(state, child);
    };
    this._bodyNodes["boxed-text"] = function (state, child) {
        return this.boxedText(state, child);
    };
    this._bodyNodes["disp-quote"] = function (state, child) {
        return this.quoteText(state, child);
    };
    this._bodyNodes["attrib"] = function (state, child) {
        return this.paragraphGroup(state, child);
    };
    this._bodyNodes["comment"] = function (state, child) {
        return this.comment(state, child);
    };
    this._bodyNodes["fig"] = function (state, child) {
        return this.figure(state, child);
    };
    this._bodyNodes["speech"] = function (state, child) {
        return this.speechText(state, child);
    };
    this._bodyNodes["table-wrap"] = function (state, child) {
        return this.tableWrap(state, child);
    };
    this._bodyNodes["sec-meta"] = function (state, child) {
        return this.secMeta(state, child);
    };
    this._bodyNodes["abstract"] = function (state, child) {
        return this._abstract(state, child);
    };

    this._bodyNodes["contrib-group"] = function (state, child) {
        return this.contribGroup(state, child);
    };

    this.secMeta = function (state, secMeta) {
        var doc = state.doc;
        var docNode = doc.get("document");
        var childNodes = this.bodyNodes(state, util.dom.getChildren(secMeta));

        var secMetaID = state.nextId("sec_meta");
        var secNode = {
            "id": secMetaID,
            "type": "sec_meta",
            "children": _.pluck(childNodes, 'id'),
            "authors": [],
            "abstract": []
        };

        var section_contributors = ["Section Editor", "Section Author"];
        var i;

        _.each(docNode.authors, function (contributorId) {

            var contributor = doc.get(contributorId);
            for (i = 0; i < section_contributors.length; i++) {
                if (contributor.contributor_type === section_contributors[i]) {

                    var authorsPara = {
                        "id": "text_" + contributorId + "_reference",
                        "type": "text",
                        "content": contributor.name
                    };

                    var anno = {
                        id: state.nextId("contributor_reference"),
                        type: "contributor_reference",
                        path: ["text_" + contributorId + "_reference", "content"],
                        range: [0, contributor.name.length],
                        target: contributorId
                    };


                    _.each(childNodes, function (c) {

                        if (c.type === "contributor" & c.id === contributor.id) {
                            doc.create(authorsPara);
                            secNode.authors.push(authorsPara.id);
                            doc.create(anno);
                        }
                    }, this);

                }
            }

        }, this);
        _.each(childNodes, function (c) {
            if (c.type === "abstract") {
                secNode.abstract.push(c.id);
            }
        }, this);
        doc.create(secNode);
        return secNode;
    };

    // Overwirte in specific converter
    this.ignoredNode = function (/*state, node, type*/) {
    };

    this.comment = function (/*state, comment*/) {
        // TODO: this is not yet represented in the article data model
        return null;
    };

    this.boxedText = function (state, box) {
        var doc = state.doc;
        // Assuming that there are no nested <boxed-text> elements
        var childNodes = this.bodyNodes(state, util.dom.getChildren(box));
        var boxId = state.nextId("box");
        var boxNode = {
            "type": "box",
            "id": boxId,
            "source_id": box.getAttribute("id"),
            "label": "",
            "children": _.pluck(childNodes, 'id')
        };
        doc.create(boxNode);
        return boxNode;
    };
    //this.speakerName = function (state, speech) {
    // return {};
    // }

    this.childNodes = function (state, children) {
        var nodes = [], node;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var type = util.dom.getNodeType(child);

            if (this.childNodes[type]) {
                var result = this.childNodes[type].call(this, state, child);
                if (_.isArray(result)) {
                    nodes = nodes.concat(result);
                } else if (result) {
                    nodes.push(result);
                } else {
                    // skip
                }
            }
        }
        return nodes;
    };

    this.speakerName = function (state, speaker) {

        var speakerName = {
            "type": "speaker",
            "label": "Speaker",
            "children": speaker.innerHTML
        };

        return speakerName;
    };
    this.quoteText = function (state, quote) {
        var doc = state.doc;
        // Assuming that there are no nested <disp-quote> elements
        var childNodes = this.bodyNodes(state, util.dom.getChildren(quote));
        var quoteId = state.nextId("quote");
        var quoteNode = {
            "type": "quote",
            "id": quoteId,
            "source_id": quote.getAttribute("id"),
            "label": "",
            "children": _.pluck(childNodes, 'id')
        };
        doc.create(quoteNode);
        return quoteNode;
    };

    this.speechText = function (state, speech) {
        var doc = state.doc;
        var childNodes = this.bodyNodes(state, util.dom.getChildren(speech));
        var speechId = state.nextId("speech");
        var speechNode = {
            "type": "speech",
            "id": speechId,
            "source_id": speech.getAttribute("id"),
            "label": "",
            "speaker": speech.querySelectorAll("speaker"),
            "children": _.pluck(childNodes, 'id')
        };
        doc.create(speechNode);
        return speechNode;
    };

    this.datasets = function (state, datasets) {
        var nodes = [];

        for (var i = 0; i < datasets.length; i++) {
            var data = datasets[i];
            var type = util.dom.getNodeType(data);
            if (type === 'p') {
                var obj = data.querySelector('related-object');
                if (obj) {
                    nodes = nodes.concat(this.indivdata(state, obj));
                }
                else {
                    var par = this.paragraphGroup(state, data);
                    if (par.length > 0) nodes.push(par[0].id);
                }
            }
        }
        return nodes;
    };

    this.indivdata = function (state, indivdata) {
        var doc = state.doc;

        var p1 = {
            "type": "paragraph",
            "id": state.nextId("paragraph"),
            "children": []
        };
        var text1 = {
            "type": "text",
            "id": state.nextId("text"),
            "content": ""
        };
        p1.children.push(text1.id);
        var input = util.dom.getChildren(indivdata);
        for (var i = 0; i < input.length; i++) {
            var info = input[i];
            var type = util.dom.getNodeType(info);
            var par;
            if (type === "name") {
                var children = util.dom.getChildren(info);
                for (var j = 0; j < children.length; j++) {
                    var name = children[j];
                    if (j === 0) {
                        par = this.paragraphGroup(state, name);
                        p1.children.push(par[0].children[0]);
                    }
                    else {
                        var text2 = {
                            "type": "text",
                            "id": state.nextId("text"),
                            "content": ", "
                        };
                        doc.create(text2);
                        p1.children.push(text2.id);
                        par = this.paragraphGroup(state, name);
                        p1.children.push(par[0].children[0]);
                    }
                }
            }
            else {
                par = this.paragraphGroup(state, info);
                // Smarter null reference check?
                if (par && par[0] && par[0].children) {
                    p1.children.push(par[0].children[0]);
                }
            }
        }
        doc.create(p1);
        doc.create(text1);
        return p1.id;
    };

    this.section = function (state, section) {
        // pushing the section level to track the level for nested sections
        state.sectionLevel++;

        var doc = state.doc;
        var children = util.dom.getChildren(section);
        var nodes = [];

        // Optional heading label
        var label = this.selectDirectChildren(section, "label")[0];

        // create a heading
        var title = this.selectDirectChildren(section, 'title')[0];


        if (!title) {
            console.error("FIXME: every section should have a title", this.toHtml(section));


        }
        // Recursive Descent: get all section body nodes
        nodes = nodes.concat(this.bodyNodes(state, children, {
            ignore: ["title", "label", "sec-meta"]
        }));

        if (nodes.length > 0 && title) {
            var id = state.nextId("heading");
            var heading = {
                id: id,
                source_id: section.getAttribute("id"),
                type: "heading",
                level: state.sectionLevel,
                content: title ? this.annotatedText(state, title, [id, 'content']) : "",
                authors: []

            };
            if (heading.content.length > 1) {
                var sec = this.selectDirectChildren(section, 'sec-meta')[0];
                if (sec !== undefined) {
                    var contribGroup = sec.querySelector("contrib-group");
                    var contribs = contribGroup.querySelectorAll("contrib");
                    for (var i = 0; i < contribs.length; i++) {
                        var nameEl = contribs[i].querySelector("name");
                        if (nameEl) {
                            var name = this.getName(nameEl);
                            heading.authors.push(name);
                        }


                    }



                }

            }


            if (label) {
                heading.label = label.textContent;
            }
            if (heading.content.length > 0) {
                doc.create(heading);
                nodes.unshift(heading);
            }
        } else if (nodes.length === 0) {
            console.info("NOTE: skipping section without content:", title ? title.innerHTML : "no title");
        }


        // popping the section level
        state.sectionLevel--;
        return nodes;
    };

    this.ignoredParagraphElements = {
        "comment": true,
        "supplementary-material": true,
        "fig": true,
        "fig-group": true,
        "media": true,

    };

    this.acceptedParagraphElements = {
        "boxed-text": {handler: "boxedText"},
        "disp-quote": {handler: "quoteText"},
        "list": {handler: "list"},
        "disp-formula": {handler: "formula"},
        "speech": {handler: "speechText"},
        "table-wrap": {handler: "tableWrap"}
    };

    this.inlineParagraphElements = {
        "inline-graphic": true,
        "inline-formula": true,

    };

    // Segments children elements of a NLM <p> element
    // into blocks grouping according to following rules:
    // - "text", "inline-graphic", "inline-formula", and annotations
    // - ignore comments, supplementary-materials
    // - others are treated as singles
    this.segmentParagraphElements = function (paragraph) {
        var blocks = [];
        var lastType = "";
        //TODO td as element
        //paragraph = document.createElement('td');
        //paragraph.innerHTML='-';
        var iterator = new util.dom.ChildNodeIterator(paragraph);

        // first fragment the childNodes into blocks
        while (iterator.hasNext()) {
            var child = iterator.next();
            var type = util.dom.getNodeType(child);

            // ignore some elements
            if (this.ignoredParagraphElements[type]) continue;

            // paragraph elements
            if (type === "text" || this.isAnnotation(type) || this.inlineParagraphElements[type]) {
                if (lastType !== "paragraph") {
                    blocks.push({handler: "paragraph", nodes: []});
                    lastType = "paragraph";
                }
                _.last(blocks).nodes.push(child);
                continue;
            }
            // other elements are treated as single blocks
            else if (this.acceptedParagraphElements[type]) {
                blocks.push(_.extend({node: child}, this.acceptedParagraphElements[type]));
            }
            lastType = type;
        }
        return blocks;
    };


    // A 'paragraph' is given a '<p>' tag
    // An NLM <p> can contain nested elements that are represented flattened in a Substance.Article
    // Hence, this function returns an array of nodes
    this.paragraphGroup = function (state, paragraph) {
        var nodes = [];

        // Note: there are some elements in the NLM paragraph allowed
        // which are flattened here. To simplify further processing we
        // segment the children of the paragraph elements in blocks
        var blocks = this.segmentParagraphElements(paragraph);
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];


            var node;
            if (block.handler === "paragraph") {
                node = this.paragraph(state, block.nodes);
                if (node) {
                    node.source_id = paragraph.getAttribute("id");
                    node.attributes = paragraph.attributes;
                }
                ;
            } else {
                node = this[block.handler](state, block.node);
            }
            if (node) nodes.push(node);
        }

        return nodes;
    };

    this.paragraph = function (state, children) {
        var doc = state.doc;

        // Reset whitespace handling at the beginning of a paragraph.
        // I.e., whitespaces at the beginning will be removed rigorously.
        state.skipWS = true;

        var node = {
            id: state.nextId("paragraph"),
            type: "paragraph",
            children: null
        };
        var nodes = [];

        var iterator = new util.dom.ChildNodeIterator(children);
        while (iterator.hasNext()) {
            var child = iterator.next();
            var type = util.dom.getNodeType(child);

            // annotated text node
            if (type === "text" || this.isAnnotation(type)) {
                var textNode = {
                    id: state.nextId("text"),
                    type: "text",
                    content: null
                };
                // pushing information to the stack so that annotations can be created appropriately
                state.stack.push({
                    path: [textNode.id, "content"]
                });
                // Note: this will consume as many textish elements (text and annotations)
                // but will return when hitting the first un-textish element.
                // In that case, the iterator will still have more elements
                // and the loop is continued
                // Before descending, we reset the iterator to provide the current element again.
                var annotatedText = this._annotatedText(state, iterator.back(), {offset: 0, breakOnUnknown: true});

                // Ignore empty paragraphs
                if (annotatedText.length > 0) {
                    textNode.content = annotatedText;
                    doc.create(textNode);
                    nodes.push(textNode);
                }

                // popping the stack
                state.stack.pop();
            }

            // inline image node
            else if (type === "inline-graphic") {
                var url = child.getAttribute("xlink:href");
                var img = {
                    id: state.nextId("image"),
                    type: "image",
                    url: this.resolveURL(state, url)
                };
                doc.create(img);
                nodes.push(img);
            }
            else if (type === "inline-formula") {
                var formula = this.formula(state, child, "inline");
                if (formula) {
                    nodes.push(formula);
                }
            }
        }

        // return if there is no content
        if (nodes.length === 0) return null;

        // FIXME: ATM we can not unwrap single nodes, as there is code relying
        // on getting a paragraph with children
        // // if there is only a single node, do not create a paragraph around it
        // if (nodes.length === 1) {
        //   return nodes[0];
        // } else {
        //   node.children = _.map(nodes, function(n) { return n.id; } );
        //   doc.create(node);
        //   return node;
        // }

        node.children = _.map(nodes, function (n) {
            return n.id;
        });
        doc.create(node);
        return node;
    };

    // List type
    // --------

    this.list = function (state, list) {
        var doc = state.doc;

        var listNode = {
            "id": state.nextId("list"),
            "source_id": list.getAttribute("id"),
            "type": "list",
            "items": [],
            "item_ids": [],
            "ordered": false,
            "list_type": ""
        };

        // TODO: better detect ordererd list types (need examples)
        var ltype = list.getAttribute("list-type");
        var o_types = ["alpha-lower", "alpha-upper", "ordered", "roman-lower", "roman-upper"];
        var i;
        for (i = 0; i < o_types.length; i++) {
            if (ltype === o_types[i]) {
                listNode.ordered = true;
            }
        }

        listNode.list_type = list.getAttribute("list-type");
        var listItems = list.querySelectorAll("list-item");

        for (var i = 0; i < listItems.length; i++) {
            var listItem = listItems[i];
            if (listItem.parentNode !== list) continue;
            var nodes = this.bodyNodes(state, util.dom.getChildren(listItem));
            for (var j = 0; j < nodes.length; j++) {
                listNode.items.push(nodes[j].id);
                listNode.item_ids.push(i);
            }
        }
        doc.create(listNode);
        return listNode;
    };

    // Handle <fig> element
    // --------
    //

    this.figure = function (state, figure) {
        var doc = state.doc;

        // Top level figure node
        var figureNode = {
            "type": "figure",
            "id": state.nextId("figure"),
            "source_id": figure.getAttribute("id"),
            "label": "Figure",
            "url": "",
            "caption": null
        };

        var labelEl = figure.querySelector("label");
        if (labelEl) {
            figureNode.label = this.annotatedText(state, labelEl, [figureNode.id, 'label']);
        }

        // Add a caption if available
        var caption = figure.querySelector("caption");
        if (caption) {
            var captionNode = this.caption(state, caption);
            if (captionNode) figureNode.caption = captionNode.id;
        }

        var attrib = figure.querySelector("attrib");
        if (attrib) {
            figureNode.attrib = attrib.textContent;
        }

        var position = figure.getAttribute('position');
        if (position) {
            figureNode.position = position || '';
        }

        // Lets the configuration patch the figure node properties
        this.enhanceFigure(state, figureNode, figure);
        doc.create(figureNode);

        //HACK: add this information so that we can implement the catch-all converter for figures et al.
        figure._converted = true;

        return figureNode;
    };

    // Handle <supplementary-material> element
    // --------
    //
    // eLife Example:
    //
    // <supplementary-material id="SD1-data">
    //   <object-id pub-id-type="doi">10.7554/eLife.00299.013</object-id>
    //   <label>Supplementary file 1.</label>
    //   <caption>
    //     <title>Compilation of the tables and figures (XLS).</title>
    //     <p>This is a static version of the
    //       <ext-link ext-link-type="uri" xlink:href="http://www.vaxgenomics.org/vaxgenomics/" xmlns:xlink="http://www.w3.org/1999/xlink">
    //         Interactive Results Tool</ext-link>, which is also available to download from Zenodo (see major datasets).</p>
    //     <p>
    //       <bold>DOI:</bold>
    //       <ext-link ext-link-type="doi" xlink:href="10.7554/eLife.00299.013">http://dx.doi.org/10.7554/eLife.00299.013</ext-link>
    //     </p>
    //   </caption>
    //   <media mime-subtype="xlsx" mimetype="application" xlink:href="elife00299s001.xlsx"/>
    // </supplementary-material>
    //
    // LB Example:
    //
    // <supplementary-material id="SUP1" xlink:href="2012INTRAVITAL024R-Sup.pdf">
    //   <label>Additional material</label>
    //   <media xlink:href="2012INTRAVITAL024R-Sup.pdf"/>
    // </supplementary-material>

    this.supplement = function (state, supplement) {
        var doc = state.doc;

        //get supplement info
        var label = supplement.querySelector("label");

        var mediaEl = supplement.querySelector("media");
        var url = mediaEl ? mediaEl.getAttribute("xlink:href") : null;
        var doi = supplement.querySelector("object-id[pub-id-type='doi']");
        //doi = doi ? "http://dx.doi.org/" + doi.textContent : "";
        doi = doi ?  doi.textContent : "";

        //create supplement node using file ids
        var supplementNode = {
            "id": state.nextId("supplement"),
            "source_id": supplement.getAttribute("id"),
            "type": "supplement",
            "label": label ? label.textContent : "",
            "url": url,
            "caption": null
        };

        // Add a caption if available
        var caption = supplement.querySelector("caption");

        if (caption) {
            var captionNode = this.caption(state, caption);
            if (captionNode) supplementNode.caption = captionNode.id;
        }

        // Let config enhance the node
        this.enhanceSupplement(state, supplementNode, supplement);
        doc.create(supplementNode);

        return supplementNode;
    };

    // Used by Figure, Table, Video, Supplement types.
    // --------

    this.caption = function (state, caption) {
        var doc = state.doc;

        var captionNode = {
            "id": state.nextId("caption"),
            "source_id": caption.getAttribute("id"),
            "type": "caption",
            "title": "",
            "children": []
        };

        // Titles can be annotated, thus delegate to paragraph
        var title = caption.querySelector("title");
        if (title) {
            // Resolve title by delegating to the paragraph
            var node = this.paragraph(state, title);
            if (node) {
                captionNode.title = node.id;
            }
        }

        var children = [];
        var paragraphs = caption.querySelectorAll("p");
        _.each(paragraphs, function (p) {
            // Only consider direct children
            if (p.parentNode !== caption) return;
            var node = this.paragraph(state, p);
            if (node) children.push(node.id);
        }, this);

        captionNode.children = children;
        doc.create(captionNode);

        return captionNode;
    };

    // Example video element
    //
    // <media content-type="glencoe play-in-place height-250 width-310" id="movie1" mime-subtype="mov" mimetype="video" xlink:href="elife00005m001.mov">
    //   <object-id pub-id-type="doi">
    //     10.7554/eLife.00005.013</object-id>
    //   <label>Movie 1.</label>
    //   <caption>
    //     <title>Movement of GFP tag.</title>
    //     <p>
    //       <bold>DOI:</bold>
    //       <ext-link ext-link-type="doi" xlink:href="10.7554/eLife.00005.013">http://dx.doi.org/10.7554/eLife.00005.013</ext-link>
    //     </p>
    //   </caption>
    // </media>

    this.video = function (state, video) {
        var doc = state.doc;
        var label = video.querySelector("label").textContent;

        var id = state.nextId("video");
        var videoNode = {
            "id": id,
            "source_id": video.getAttribute("id"),
            "type": "video",
            "label": label,
            "title": "",
            "caption": null,
            "poster": ""
        };

        // Add a caption if available
        var caption = video.querySelector("caption");
        if (caption) {
            var captionNode = this.caption(state, caption);
            if (captionNode) videoNode.caption = captionNode.id;
        }
        // Add a poster if avaliable
        var object_id = video.querySelector("object-id");
        if (object_id) {
            if (object_id.getAttribute('specific-use') === 'poster') {
                videoNode.poster = object_id.textContent;
            }
        }
        this.enhanceVideo(state, videoNode, video);

        doc.create(videoNode);

        return videoNode;
    };

    this.tableWrap = function (state, tableWrap) {

        var doc = state.doc;
        var label = tableWrap.querySelector("label");
        var table = tableWrap.querySelector("table");
        var content = {};
        var trs = {};
        var tds = {};
        var prs = {};
        var _trs = table.children;

       for (var i = 0; i < _trs.length; i++) {
            var _tds = _trs[i].children;
            for (var j = 0; j < _tds.length; j++) {
                var childNodes = _tds[j].childNodes;

                for (var k = 0; k < childNodes.length; k++) {
                    var child = childNodes[k];
                    tds[k] ={}
                    if (child.nodeName === '#text') {
                        var textCotent = child.data.trim();
                        if (textCotent.length > 0) {
                            var p = document.createElement('p');
                            var t = document.createTextNode(textCotent);
                            p.appendChild(t);
                            tds[k].nodes = this.paragraphGroup(state, p);
                        }
                    }

                    else if (child.nodeName === 'p') {

                        tds[k].nodes = this.paragraphGroup(state, child);


                    }
                    else {
                        console.error(' element not allowed in table', child);
                    }
                    tds[k].attributes = _tds[j].attributes;

                }
                trs[j] = tds;
                tds = {};
            }
            content[i] = trs;
            trs = {};

        }


        var tableNode = {
            "id": state.nextId("html_table"),
            "source_id": tableWrap.getAttribute("id"),
            "type": "html_table",
            "title": "",
            "label": label ? label.textContent : "Table",
            "children": content,
            "html_table_attributes": table.attributes,
            "caption": null,
            footers: [],

        };
       // TODO table node:

        this.extractTableCaption(state, tableNode, tableWrap);

        this.enhanceTable(state, tableNode, tableWrap);
        doc.create(tableNode);

        return tableNode;
    };

    this.extractTableCaption = function (state, tableNode, tableWrap) {
        // Add a caption if available
        var caption = tableWrap.querySelector("caption");
        if (caption) {
            var captionNode = this.caption(state, caption);
            if (captionNode) tableNode.caption = captionNode.id;
        } else {
            console.error('caption node not found for', tableWrap);
        }
    };

// Formula Node Type
// --------

    this._getFormulaData = function (formulaElement) {
        var result = [];
        for (var child = formulaElement.firstElementChild; child; child = child.nextElementSibling) {
            var type = util.dom.getNodeType(child);
            switch (type) {
                case "graphic":
                case "inline-graphic":
                    result.push({
                        format: 'image',
                        data: child.getAttribute('xlink:href')
                    });
                    break;
                case "svg":
                    result.push({
                        format: "svg",
                        data: this.toHtml(child)
                    });
                    break;
                case "mml:math":
                case "math":
                    result.push({
                        format: "mathml",
                        data: this.mmlToHtmlString(child)
                    });
                    break;
                case "tex-math":
                    result.push({
                        format: "latex",
                        data: child.textContent
                    });
                    break;
                case "label":
                    // Skipping - is handled in this.formula()
                    break;
                default:
                    console.error('Unsupported formula element of type ' + type);
            }
        }
        return result;
    };

    this.formula = function (state, formulaElement, inline) {
        var doc = state.doc;
        var formulaNode = {
            id: state.nextId("formula"),
            source_id: formulaElement.getAttribute("id"),
            type: "formula",
            label: "",
            inline: !!inline,
            data: [],
            format: [],
        };
        var label = formulaElement.querySelector("label");
        if (label) formulaNode.label = label.textContent;
        var formulaData = this._getFormulaData(formulaElement, inline);
        for (var i = 0; i < formulaData.length; i++) {
            formulaNode.format.push(formulaData[i].format);
            formulaNode.data.push(formulaData[i].data);
        }
        doc.create(formulaNode);
        return formulaNode;
    };

// footnotes
    this.fnList = function (state, fnList) {
        var fns = fnList.querySelectorAll("fn");
        for (var i = 0; i < fns.length; i++) {
            this.fn(state, fns[i]);
        }
    };
    this.rererenceTypes = {
        "p": true,
    };

    this.fn = function (state, fn) {
        var children = util.dom.getChildren(fn);
        this.footnote(state, fn, children);
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var type = util.dom.getNodeType(child);
            var nodes = this.paragraph(state, fn, child);
         //   console.log('converte fn',fn);
            /**
             if (this.rererenceTypes[type]) {

            } else if (type === "label") {
                // TODO: could we do something useful with it?
            } else {
                console.error("Not supported in 'fn': ", type);
            }
             */
        }

    };

    this.footnote = function (state, fn, footnote) {
        //console.log('calling footnode', footnote);
        var doc = state.doc;
        var footnoteNode;
        var i, j, k;
        var blocks = [];
        var id = state.nextId("article_footnote");


        footnoteNode = {
            "id": id,
            "source_id": fn.getAttribute("id"),
            "type": "footnote",
            "text": "N/A",
            "label": "",
            "authors": [],
            "doi": "",
            "source": "",
            "volume": "",
            "fpage": "",
            "lpage": "",
            "citation_urls": []
        }


        for (k = 0; k < footnote.length; k++) {
            //console.log(footnote[k]);
            //console.log(this.segmentParagraphElements(footnote[k])[0]);

            blocks.push(this.segmentParagraphElements(footnote[k])[0]);

        }
        //console.log(blocks);
        //var blocks = this.segmentParagraphElements(footnote);

        for (i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            for (j = 0; j < block.nodes.length; j++) {
                if (block.nodes[j].tagName == 'xref') {
                    //console.log("block", block);
                    var sourceId = block.nodes[j].getAttribute("rid");
                    //console.log("sourceId",sourceId);
                    var targetNode = state.doc.getNodeBySourceId(sourceId);
                    //console.log("targetNode",targetNode);
                    if (targetNode !== undefined) {
                        block.nodes[j].target = targetNode.properties.id;
                    }
                }
            }
        }
        ////console.log('foonote blocks', blocks);
        footnoteNode.text = blocks;
        //console.log("fn",footnoteNode);
        doc.create(footnoteNode);
        doc.show("footnotes", id);
        return footnoteNode;
    };

// Citations
// ---------

    this.citationTypes = {
        "mixed-citation": true,
        "element-citation": true
    };

    this.refList = function (state, refList) {
        var refs = refList.querySelectorAll("ref");
        for (var i = 0; i < refs.length; i++) {
            this.ref(state, refs[i]);
        }
    };

    this.ref = function (state, ref) {
        var children = util.dom.getChildren(ref);
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var type = util.dom.getNodeType(child);

            if (this.citationTypes[type]) {
                this.citation(state, ref, child);
            } else if (type === "label") {
                // skip the label here...
                // TODO: could we do something useful with it?
            } else {
                console.error("Not supported in 'ref': ", type);
            }
        }
    };

// Citation
// ------------------
// NLM input example
//
// <element-citation publication-type="journal" publication-format="print">
// <name><surname>Llanos De La Torre Quiralte</surname>
// <given-names>M</given-names></name>
// <name><surname>Garijo Ayestaran</surname>
// <given-names>M</given-names></name>
// <name><surname>Poch Olive</surname>
// <given-names>ML</given-names></name>
// <article-title xml:lang="es">Evolucion de la mortalidad
// infantil de La Rioja (1980-1998)</article-title>
// <trans-title xml:lang="en">Evolution of the infant
// mortality rate in la Rioja in Spain
// (1980-1998)</trans-title>
// <source>An Esp Pediatr</source>
// <year>2001</year>
// <month>Nov</month>
// <volume>55</volume>
// <issue>5</issue>
// <fpage>413</fpage>
// <lpage>420</lpage>
// <comment>Figura 3, Tendencia de mortalidad infantil
// [Figure 3, Trends in infant mortality]; p. 418.
// Spanish</comment>
// </element-citation>

// TODO: is implemented naively, should be implemented considering the NLM spec
    this.citation = function (state, ref, citation) {
        var doc = state.doc;
        var citationNode;
        var i;

        var id = state.nextId("article_citation");

        // TODO: we should consider to have a more structured citation type
        // and let the view decide how to render it instead of blobbing everything here.
        var personGroup = citation.querySelector("person-group");

        // HACK: we try to create a 'articleCitation' when there is structured
        // content (ATM, when personGroup is present)
        // Otherwise we create a mixed-citation taking the plain text content of the element
        if (personGroup) {

            citationNode = {
                "id": id,
                "source_id": ref.getAttribute("id"),
                "type": "citation",
                "title": "N/A",
                "label": "",
                "authors": [],
                "doi": "",
                "source": "",
                "volume": "",
                "fpage": "",
                "lpage": "",
                "citation_urls": []
            };

            var nameElements = personGroup.querySelectorAll("name");
            for (i = 0; i < nameElements.length; i++) {
                citationNode.authors.push(this.getName(nameElements[i]));
            }

            // Consider collab elements (treat them as authors)
            var collabElements = personGroup.querySelectorAll("collab");
            for (i = 0; i < collabElements.length; i++) {
                citationNode.authors.push(collabElements[i].textContent);
            }

            var source = citation.querySelector("source");
            if (source) citationNode.source = source.textContent;

            var articleTitle = citation.querySelector("article-title");
            if (articleTitle) {
                citationNode.title = this.annotatedText(state, articleTitle, [id, 'title']);
            } else {
                var comment = citation.querySelector("comment");
                if (comment) {
                    citationNode.title = this.annotatedText(state, comment, [id, 'title']);
                } else {
                    // 3rd fallback -> use source
                    if (source) {
                        citationNode.title = this.annotatedText(state, source, [id, 'title']);
                    } else {
                        console.error("FIXME: this citation has no title", citation);
                    }
                }
            }

            var volume = citation.querySelector("volume");
            if (volume) citationNode.volume = volume.textContent;

            var publisherLoc = citation.querySelector("publisher-loc");
            if (publisherLoc) citationNode.publisher_location = publisherLoc.textContent;

            var publisherName = citation.querySelector("publisher-name");
            if (publisherName) citationNode.publisher_name = publisherName.textContent;

            var fpage = citation.querySelector("fpage");
            if (fpage) citationNode.fpage = fpage.textContent;

            var lpage = citation.querySelector("lpage");
            if (lpage) citationNode.lpage = lpage.textContent;

            var year = citation.querySelector("year");
            if (year) citationNode.year = year.textContent;

            // Note: the label is child of 'ref'
            var label = ref.querySelector("label");
            if (label) citationNode.label = label.textContent;

            var doi = citation.querySelector("pub-id[pub-id-type='doi'], ext-link[ext-link-type='doi']");

            //if (doi) citationNode.doi = "http://dx.doi.org/" + doi.textContent;
            if (doi) citationNode.doi =  doi.textContent;
        } else {
            var blocks = this.segmentParagraphElements(citation);
            var i, j;
            for (i = 0; i < blocks.length; i++) {
                var block = blocks[i];
                for (j = 0; j < block.nodes.length; j++) {
                    if (block.nodes[j].tagName == 'xref') {
                        var sourceId = block.nodes[j].getAttribute("rid");
                        var targetNode = state.doc.getNodeBySourceId(sourceId);
                        if (targetNode !== undefined) {
                            block.nodes[j].target = targetNode.properties.id;
                        }
                    }
                    else {

                    }
                }
            }

            citationNode = {
                "id": id,
                "source_id": ref.getAttribute("id"),
                "type": "mixed_citation",
                "text": blocks,
                "doi": ""
            };


        }
        //console.log("citationNode", citationNode);
        doc.create(citationNode);
        doc.show("citations", id);

        return citationNode;
    };

// Article.Back
// --------

    this.back = function (/*state, back*/) {
        // No processing at the moment
        return null;
    };


// Annotations
// -----------

    this.createAnnotation = function (state, el, start, end) {
        // do not create an annotaiton if there is no range
        if (start === end) return;
        var type = el.tagName.toLowerCase();
        var anno = {
            type: "annotation",
            path: _.last(state.stack).path,
            range: [start, end],
        };
        this.addAnnotationData(state, anno, el, type);
        this.enhanceAnnotationData(state, anno, el, type);

        // assign an id after the type has been extracted to be able to create typed ids
        anno.id = state.nextId(anno.type);
        state.annotations.push(anno);
    };

// Called for annotation types registered in this._annotationTypes
    this.addAnnotationData = function (state, anno, el, type) {
        anno.type = this._annotationTypes[type] || "annotation";
        if (type === 'xref') {
            this.addAnnotationDataForXref(state, anno, el);
        } else if (type === "ext-link" || type === "uri") {
            anno.url = el.getAttribute("xlink:href");
            // Add 'http://' to URIs without a protocol, such as 'www.google.com'
            // Except: Url starts with a slash, then we consider them relative
            var extLinkType = el.getAttribute('ext-link-type') || '';
            if ((type === "uri" || extLinkType.toLowerCase() === 'uri') && !/^\w+:\/\//.exec(anno.url) && !/^\//.exec(anno.url)) {
                anno.url = 'http://' + anno.url;
            } else if (extLinkType.toLowerCase() === 'doi') {
                //TODO Anno url
                //anno.url = ["http://dx.doi.org/", anno.url].join("");
            }
        } else if (type === "email") {
            anno.url = "mailto:" + el.textContent.trim();
        } else if (type === 'inline-graphic') {
            anno.url = el.getAttribute("xlink:href");
        } else if (type === 'inline-formula') {
            var formula = this.formula(state, el, "inline");
            anno.target = formula.id;
        }
    };
    this.addAnnotationDataForXref = function (state, anno, el) {

        var refType = el.getAttribute("ref-type");
        var sourceId = el.getAttribute("rid");

        // Default reference is a cross_reference
        anno.type = this._refTypeMapping[refType] || "cross_reference";
        //console.log("anno",anno);
        if (sourceId) anno.target = sourceId;
    };

// Parse annotated text
// --------------------
// Make sure you call this method only for nodes where `this.isParagraphish(node) === true`
//
    this.annotatedText = function (state, node, path, options) {
        options = options || {};
        state.stack.push({
            path: path,
            ignore: options.ignore
        });
        var childIterator = new util.dom.ChildNodeIterator(node);
        var text = this._annotatedText(state, childIterator, options);
        state.stack.pop();
        return text;
    };

// Internal function for parsing annotated text
// --------------------------------------------
// As annotations are nested this is a bit more involved and meant for
// internal use only.
//
    this._annotatedText = function (state, iterator, options) {
        var plainText = "";

        var charPos = (options.offset === undefined) ? 0 : options.offset;
        var nested = !!options.nested;
        var breakOnUnknown = !!options.breakOnUnknown;

        while (iterator.hasNext()) {
            var el = iterator.next();
            // Plain text nodes...
            if (el.nodeType === Node.TEXT_NODE) {
                var text = state.acceptText(el.textContent);
                plainText += text;
                charPos += text.length;
            }
            // Annotations...
            else {
                var annotatedText;
                var type = util.dom.getNodeType(el);
                if (this.isAnnotation(type)) {
                    if (state.top().ignore.indexOf(type) < 0) {
                        var start = charPos;
                        if (this._annotationTextHandler[type]) {
                            annotatedText = this._annotationTextHandler[type].call(this, state, el, type, charPos);
                        } else {
                            annotatedText = this._getAnnotationText(state, el, type, charPos);
                        }
                        plainText += annotatedText;
                        charPos += annotatedText.length;
                        if (!state.ignoreAnnotations) {
                            this.createAnnotation(state, el, start, charPos);
                        }
                    }
                }
                // Unsupported...
                else if (!breakOnUnknown) {
                    if (state.top().ignore.indexOf(type) < 0) {
                        annotatedText = this._getAnnotationText(state, el, type, charPos);
                        plainText += annotatedText;
                        charPos += annotatedText.length;
                    }
                } else {
                    if (nested) {
                        console.error("Node not yet supported in annoted text: " + type);
                    }
                    else {
                        // on paragraph level other elements can break a text block
                        // we shift back the position and finish this call
                        iterator.back();
                        break;
                    }
                }
            }
        }
        return plainText;
    };

// A place to register handlers to override how the text of an annotation is created.
// The default implementation is this._getAnnotationText() which extracts the plain text and creates
// nested annotations if necessary.
// Examples for other implementations:
//   - links: the label of a link may be shortened in certain cases
//   - inline elements: we model inline elements by a pair of annotation and a content node, and we create a custom label.

    this._annotationTextHandler = {};

    this._getAnnotationText = function (state, el, type, charPos) {
        // recurse into the annotation element to collect nested annotations
        // and the contained plain text
        var childIterator = new util.dom.ChildNodeIterator(el);
        var annotatedText = this._annotatedText(state, childIterator, {offset: charPos, nested: true});
        return annotatedText;
    };

    this._annotationTextHandler['ext-link'] = function (state, el, type, charPos) {
        var annotatedText = this._getAnnotationText(state, el, charPos);
        // Shorten label for URL links (i.e. if label === url )
        if (type === 'ext-link' && el.getAttribute('xlink:href') === annotatedText.trim()) {
            annotatedText = this.shortenLinkLabel(state, annotatedText);
        }
        return annotatedText;
    };

    this._annotationTextHandler['inline-formula'] = function (state) {
        return state.acceptText("{{inline-formula}}");
    };

    this.shortenLinkLabel = function (state, linkLabel) {
        var LINK_MAX_LENGTH = 50;
        var MARGIN = 10;
        // The strategy is preferably to shorten the fragment after the host part, preferring the tail.
        // If this is not possible, both parts are shortened.
        if (linkLabel.length > LINK_MAX_LENGTH) {
            var match = /((?:\w+:\/\/)?[\/]?[^\/]+[\/]?)(.*)/.exec(linkLabel);
            if (!match) {
                linkLabel = linkLabel.substring(0, LINK_MAX_LENGTH - MARGIN) + '...' + linkLabel.substring(linkLabel.length - MARGIN - 3);
            } else {
                var host = match[1] || '';
                var tail = match[2] || '';
                if (host.length > LINK_MAX_LENGTH - MARGIN) {
                    linkLabel = host.substring(0, LINK_MAX_LENGTH - MARGIN) + '...' + tail.substring(tail.length - MARGIN - 3);
                } else {
                    var margin = Math.max(LINK_MAX_LENGTH - host.length - 3, MARGIN - 3);
                    linkLabel = host + '...' + tail.substring(tail.length - margin);
                }
            }
        }
        return linkLabel;
    };


// Configureable methods
// -----------------
//

    this.getBaseURL = function (state) {
        // Use xml:base attribute if present
        var baseURL = state.xmlDoc.querySelector("article").getAttribute("xml:base");
        if (baseURL) {
            return [baseURL, url].join('');
        } else {
            // Use special URL resolving for production articles
            return [
                "http://cdn.elifesciences.org/elife-articles/",
                state.doc.id,
                "/jpg/",
                url,
                ".jpg"
            ].join('');
        }
        return baseURL || state.options.baseURL;
    };

    this.enhanceArticle = function (state, article) {
        /* jshint unused:false */
        // Noop - override in custom converter
    };

    this.enhanceCover = function (state, node, element) {
        /* jshint unused:false */
        // Noop - override in custom converter
    };

// Implements resolving of relative urls
    this.enhanceFigure = function (state, node, element) {
        var graphic = element.querySelector("graphic");
        var url = graphic.getAttribute("xlink:href");
        node.url = this.resolveURL(state, url);
    };

    this.enhancePublicationInfo = function (converter, state, article) {
        /* jshint unused:false */
        // Noop - override in custom converter
    };

    this.enhanceSupplement = function (state, node, element) {
        /* jshint unused:false */
        // Noop - override in custom converter
    };

    this.enhanceTable = function (state, node, element) {
        /* jshint unused:false */
        // Noop - override in custom converter
    };

// Default video resolver
// --------
//

    this.enhanceVideo = function (state, node, element) {
        // xlink:href example: elife00778v001.mov

        var url = element.getAttribute("xlink:href");
        var name;
        // Just return absolute urls
        if (url.match(/http[s]*:/)) {

            var lastdotIdx = url.lastIndexOf(".");
            if ((url.length - lastdotIdx === 5) || (url.length - lastdotIdx === 4)) {
                name = url.substring(0, lastdotIdx);
                node.url = name + ".mp4";
                node.url_ogv = name + ".ogv";
                node.url_webm = name + ".webm";
                node.poster = name + ".png";
            }
            else {
                node.url = url;
            }

            return;
        } else {
            /*
             var baseURL = this.getBaseURL(state);
             name = url.split(".")[0];
             node.url = baseURL + name + ".mp4";
             node.url_ogv = baseURL + name + ".ogv";
             node.url_webm = baseURL + name + ".webm";
             node.poster = baseURL + name + ".png";
             */
        }
    };

// Default figure url resolver
// --------
//
// For relative urls it uses the same basebath as the source XML

    this.resolveURL = function (state, url) {
        // Just return absolute urls
        if (url.match(/http:/)) return url;
        return [
            state.options.baseURL,
            url
        ].join('');
    };

    this.viewMapping = {
        // "image": "figures",
        "box": "content",
        "supplement": "figures",
        "figure": "figures",
        //"html_table": "figures",
        "video": "figures"
    };

    this.enhanceAnnotationData = function (state, anno, element, type) {
        /* jshint unused:false */
    };

    this.showNode = function (state, node) {
        var view = this.viewMapping[node.type] || "content";
        state.doc.show(view, node.id);
    };

}
;

NlmToLensConverter.State = function (converter, xmlDoc, doc) {
    var self = this;

    // the input xml document
    this.xmlDoc = xmlDoc;

    // the output substance document
    this.doc = doc;

    // keep track of the options
    this.options = converter.options;

    // this.config = new DefaultConfiguration();

    // store annotations to be created here
    // they will be added to the document when everything else is in place
    this.annotations = [];

    // when recursing into sub-nodes it is necessary to keep the stack
    // of processed nodes to be able to associate other things (e.g., annotations) correctly.
    this.stack = [];

    this.sectionLevel = 1;

    // Tracks all available affiliations
    this.affiliations = [];

    // an id generator for different types
    var ids = {};
    this.nextId = function (type) {
        ids[type] = ids[type] || 0;
        ids[type]++;
        return type + "_" + ids[type];
    };

    // store ids here which have been processed already
    this.used = {};

    // Note: it happens that some XML files are edited without considering the meaning of whitespaces
    // to increase readability.
    // This *hack* eliminates multiple whitespaces at the begin and end of textish elements.
    // Tabs and New Lines are eliminated completely. So with this, the preferred way to prettify your XML
    // is to use Tabuators and New Lines. At the same time, it is not possible anymore to have soft breaks within
    // a text.

    var WS_LEFT = /^\s+/g;
    var WS_LEFT_ALL = /^\s*/g;
    var WS_RIGHT = /\s+$/g;
    var WS_ALL = /\s+/g;
    // var ALL_WS_NOTSPACE_LEFT = /^[\t\n]+/g;
    // var ALL_WS_NOTSPACE_RIGHT = /[\t\n]+$/g;
    var SPACE = " ";
    var TABS_OR_NL = /[\t\n\r]+/g;

    this.lastChar = "";
    this.skipWS = false;

    this.acceptText = function (text) {
        if (!this.options.TRIM_WHITESPACES) {
            return text;
        }

        // EXPERIMENTAL: drop all 'formatting' white-spaces (e.g., tabs and new lines)
        // (instead of doing so only at the left and right end)
        //text = text.replace(ALL_WS_NOTSPACE_LEFT, "");
        //text = text.replace(ALL_WS_NOTSPACE_RIGHT, "");
        text = text.replace(TABS_OR_NL, "");

        if (this.lastChar === SPACE || this.skipWS) {
            // ignores one space for empty table elements
            if (text !== SPACE) {
                text = text.replace(WS_LEFT_ALL, '');
            }

        } else {
            text = text.replace(WS_LEFT, SPACE);

        }

        // this state is only kept for one call
        this.skipWS = false;

        text = text.replace(WS_RIGHT, SPACE);

        // EXPERIMENTAL: also remove white-space within
        if (this.options.REMOVE_INNER_WS) {
            text = text.replace(WS_ALL, SPACE);
        }

        this.lastChar = text[text.length - 1] || this.lastChar;
        return text;
    };

    this.top = function () {
        var top = _.last(self.stack);
        top = top || {};
        top.ignore = top.ignore || [];
        return top;
    };
};

NlmToLensConverter.prototype = new NlmToLensConverter.Prototype();
NlmToLensConverter.prototype.constructor = NlmToLensConverter;

// NlmToLensConverter.DefaultConfiguration = DefaultConfiguration;

NlmToLensConverter.DefaultOptions = {
    TRIM_WHITESPACES: true,
    REMOVE_INNER_WS: true
};

module.exports = NlmToLensConverter;

},{"../article":5,"../substance/util":195,"underscore":198}],144:[function(require,module,exports){
var ContainerPanel = require('./panels/container_panel');

var figuresPanel = new ContainerPanel({
  type: 'resource',
  name: 'figures',
  container: 'figures',
  title: 'Multimedia',
  icon: 'fa-picture-o',
  references: ['figure_reference'],
  zoom: true,
});

var citationsPanel = new ContainerPanel({
  type: 'resource',
  name: 'citations',
  container: 'citations',
  title: 'References',
  icon: 'fa-link',
  references: ['citation_reference'],
});

var footnotesPanel = new ContainerPanel({
    type: 'resource',
    name: 'footnotes',
    container: 'footnotes',
    title: 'Footnotes',
    icon: 'fa-link',
    references: ['footnote_reference'],
});


var definitionsPanel = new ContainerPanel({
  type: 'resource',
  name: 'definitions',
  container: 'definitions',
  title: 'Glossary',
  icon: 'fa-book',
  references: ['definition_reference'],
});

var infoPanel = new ContainerPanel({
  type: 'resource',
  name: 'info',
  container: 'info',
  title: 'Info',
  icon: 'fa-info',
  references: ['contributor_reference'],
});

module.exports = [
    citationsPanel, definitionsPanel, figuresPanel, footnotesPanel,  infoPanel
];

},{"./panels/container_panel":151}],145:[function(require,module,exports){

var ToggleResourceReference = require('./workflows/toggle_resource_reference');
var FollowCrossRefs = require('./workflows/follow_crossrefs');
var JumpToTop = require('./workflows/jump_to_top');

var workflows = [
  new ToggleResourceReference(),
  new FollowCrossRefs(),
  new JumpToTop()
];

module.exports = workflows;

},{"./workflows/follow_crossrefs":167,"./workflows/jump_to_top":168,"./workflows/toggle_resource_reference":169}],146:[function(require,module,exports){
module.exports = require('./lens');

},{"./lens":147}],147:[function(require,module,exports){
"use strict";

var Application = require("../substance/application");
var LensController = require("./lens_controller");
var LensConverter = require("lens/converter");
var LensArticle = require("lens/article");
var ResourcePanelViewFactory = require("./panels/resource_panel_viewfactory");
var ReaderController = require('./reader_controller');
var ReaderView = require('./reader_view');

var Panel = require('./panels/panel');
var PanelController = require('./panels/panel_controller');
var PanelView = require('./panels/panel_view');
var ContainerPanel = require('./panels/container_panel');
var ContainerPanelController = require('./panels/container_panel_controller');
var ContainerPanelView = require('./panels/container_panel_view');
var Workflow = require('./workflows/workflow');

var defaultPanels = require('./default_panels');
var defaultWorkflows = require('./default_workflows');

// The Lens Application
// ========
//

var Lens = function(config) {
  config = config || {};
  config.routes = config.routes || this.getRoutes();
  config.panels = config.panels || this.getPanels();
  config.workflows = config.workflows || this.getWorkflows();

  // All available converters
  config.converters = this.getConverters(config.converterOptions);

  // Note: call this after configuration, e.g., routes must be configured before
  //   as they are used to setup a router
  Application.call(this, config);

  this.controller = config.controller || this.createController(config);
};

Lens.Prototype = function() {

  this.start = function() {
    Application.prototype.start.call(this);
  };

  // Start listening to routes
  // --------

  this.render = function() {
    this.view = this.controller.createView();
    this.$el.html(this.view.render().el);
  };

  this.getRoutes = function() {
    return Lens.getDefaultRoutes();
  };

  this.getPanels = function() {
    return Lens.getDefaultPanels();
  };

  this.getWorkflows = function() {
    return Lens.getDefaultWorkflows();
  };

  this.getConverters = function(converterConfig) {
    return [ Lens.getDefaultConverter(converterConfig) ];
  };

  this.createController = function(config) {
    return new LensController(config);
  };
};

Lens.Prototype.prototype = Application.prototype;
Lens.prototype = new Lens.Prototype();
Lens.prototype.constructor = Lens;

Lens.DEFAULT_ROUTES = [
  {
    "route": ":context/:focussedNode/:fullscreen",
    "name": "document-focussed-fullscreen",
    "command": "openReader"
  },
  {
    "route": ":context/:focussedNode",
    "name": "document-focussed",
    "command": "openReader"
  },
  {
    "route": ":context",
    "name": "document-context",
    "command": "openReader"
  },
  {
    "route": "url/:url",
    "name": "document",
    "command": "openReader"
  },
  {
    "route": "",
    "name": "document",
    "command": "openReader"
  }
];

Lens.getDefaultRoutes = function() {
  return Lens.DEFAULT_ROUTES;
};

Lens.getDefaultPanels = function() {
  return defaultPanels.slice(0);
};

Lens.getDefaultWorkflows = function() {
  return defaultWorkflows.slice(0);
};

Lens.getDefaultConverter = function(converterOptions) {
  return new LensConverter(converterOptions);
};

Lens.Article = LensArticle;
Lens.ReaderController = ReaderController;
Lens.ReaderView = ReaderView;
Lens.Controller = LensController;
Lens.LensController = LensController;

Lens.Panel = Panel;
Lens.PanelController = PanelController;
Lens.PanelView = PanelView;
Lens.ContainerPanel = ContainerPanel;
Lens.ContainerPanelController = ContainerPanelController;
Lens.ContainerPanelView = ContainerPanelView;
Lens.ResourcePanelViewFactory = ResourcePanelViewFactory;

Lens.Workflow = Workflow;

module.exports = Lens;

},{"../substance/application":173,"./default_panels":144,"./default_workflows":145,"./lens_controller":148,"./panels/container_panel":151,"./panels/container_panel_controller":152,"./panels/container_panel_view":153,"./panels/panel":160,"./panels/panel_controller":161,"./panels/panel_view":162,"./panels/resource_panel_viewfactory":163,"./reader_controller":165,"./reader_view":166,"./workflows/workflow":170,"lens/article":5,"lens/converter":142}],148:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var util = require("../substance/util");
var Controller = require('../substance/application').Controller;
var LensView = require("./lens_view");
var ReaderController = require('./reader_controller');
var LensArticle = require('lens/article');
var NLMConverter = require('lens/converter');


// Lens.Controller
// -----------------
//
// Main Application Controller

var LensController = function(config) {
  Controller.call(this);

  this.config = config;
  this.Article = config.articleClass || LensArticle;
  this.converter = config.converter;
  this.converters = config.converters;

  this.converterOptions = _.extend({}, NLMConverter.DefaultOptions, config.converterOptions);

  // Main controls
  this.on('open:reader', this.openReader);
};

LensController.Prototype = function() {

  // Initial view creation
  // ===================================

  this.createView = function() {
    var view = new LensView(this);
    this.view = view;
    return view;
  };

  // After a file gets drag and dropped it will be remembered in Local Storage
  // ---------

  this.importXML = function(rawXML) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(rawXML,"text/xml");

    var doc = this.convertDocument(xmlDoc);
    this.createReader(doc, {
      panel: 'toc'
    });
  };

  // Update URL Fragment
  // -------
  //
  // This will be obsolete once we have a proper router vs app state
  // integration.

  this.updatePath = function(state) {
    var path = [];

    path.push(state.panel);

    if (state.focussedNode) {
      path.push(state.focussedNode);
    }

    if (state.fullscreen) {
      path.push('fullscreen');
    }

    window.app.router.navigate(path.join('/'), {
      trigger: false,
      replace: false
    });
  };

  this.createReader = function(doc, state) {
    var that = this;
    // Create new reader controller instance
    this.reader = new ReaderController(doc, state, this.config);
    this.reader.on('state-changed', function() {
      that.updatePath(that.reader.state);
    });
    this.modifyState({
      context: 'reader'
    });
  };

  this.convertDocument = function(data) {
    var doc;
    var i = 0;
    while (!doc && i < this.converters.length) {
      var converter = this.converters[i];
      // First match will be used as the converter
      if (converter.test(data, this.config.document_url)) {
        doc = converter.import(data);
      }
      i += 1;
    }

    if (!doc) {
      throw new Error("No suitable converter found for this document", data);
    }

    return doc;
  };



  this.openReader = function(panel, focussedNode, fullscreen) {
    var that = this;

    // The article view state
    var state = {
      panel: panel || "toc",
      focussedNode: focussedNode,
      fullscreen: !!fullscreen
    };

    // Already loaded?

    if (this.reader) {
      this.reader.modifyState(state);
    } else if (this.config.document_url === "lens_article.xml") {
      var doc = this.Article.describe();
      that.createReader(doc, state);
    } else {
      this.trigger("loading:started", "Loading");
      $.get(this.config.document_url)
      .done(function(data) {
        var doc;

        // Determine type of resource
        if ($.isXMLDoc(data)) {
          doc = that.convertDocument(data);
        } else {
          if(typeof data == 'string') data = $.parseJSON(data);
          doc = that.Article.fromSnapshot(data);
        }
        // Extract headings
        // TODO: this should be solved with an index on the document level
        // This same code occurs in TOCView!
        if (state.panel === "toc" && doc.getHeadings().length <= 2) {
          state.panel = "info";
        }
        that.createReader(doc, state);
      })
      .fail(function(err) {
        that.view.startLoading("Error during loading. Please try again.");
        console.error(err);
      });
    }
  };
};

// Exports
// --------

LensController.Prototype.prototype = Controller.prototype;
LensController.prototype = new LensController.Prototype();
_.extend(LensController.prototype, util.Events);

module.exports = LensController;

},{"../substance/application":173,"../substance/util":195,"./lens_view":150,"./reader_controller":165,"lens/article":5,"lens/converter":142,"underscore":198}],149:[function(require,module,exports){
var _ = require('underscore');
var Application = require('../substance/application');
var View = Application.View;

// This class replaces substance-surface in a minimalistic way.
// Substance.Surfance primarily is made for editing, which is not used in lens currently.
// This stub implementation represents the minimal expected Surface interface for lens.
var LensSurface = function(docCtrl, options) {
  View.call(this, options);

  this.docCtrl = docCtrl;
  this.options = options;
  this.document = docCtrl.getDocument();

  if (this.options.viewFactory) {
    this.viewFactory = this.options.viewFactory;
  } else {
    this.viewFactory = new this.document.constructor.ViewFactory(this.document.nodeTypes);
  }

  this.$el.addClass('surface');

  this.$nodes = $('<div>').addClass("nodes");
  this.$el.append(this.$nodes);
};
LensSurface.Prototype = function() {

  this.render = function() {
    this.$nodes.html(this.build());
    return this;
  };

  this.findNodeView = function(nodeId) {
    return this.el.querySelector('*[data-id='+nodeId+']');
  };

  this.build = function() {
    var frag = document.createDocumentFragment();
    _.each(this.nodes, function(nodeView) {
      nodeView.dispose();
    });
    this.nodes = {};
    var docNodes = this.docCtrl.container.getTopLevelNodes();
    _.each(docNodes, function(n) {
      var view = this.renderNodeView(n);
      this.nodes[n.id] = view;
      frag.appendChild(view.el);
    }, this);
    return frag;
  };

  this.renderNodeView = function(n) {
    var view = this.viewFactory.createView(n, { topLevel: true });
    view.render();
    return view;
  };

};
LensSurface.Prototype.prototype = View.prototype;
LensSurface.prototype = new LensSurface.Prototype();
LensSurface.prototype.constructor = LensSurface;

module.exports = LensSurface;

},{"../substance/application":173,"underscore":198}],150:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var View = require("../substance/application").View;
var $$ = require("../substance/application").$$;

// Lens.View Constructor
// ========
//

var LensView = function(controller) {
  View.call(this);

  this.controller = controller;
  this.$el.attr({id: "container"});

  // Handle state transitions
  // --------

  this.listenTo(this.controller, 'state-changed', this.onStateChanged);
  this.listenTo(this.controller, 'loading:started', this.startLoading);

  $(document).on('dragover', function () { return false; });
  $(document).on('ondragend', function () { return false; });
  $(document).on('drop', this.handleDroppedFile.bind(this));
};

LensView.Prototype = function() {

  this.handleDroppedFile = function(/*e*/) {
    var ctrl = this.controller;
    var files = event.dataTransfer.files;
    var file = files[0];
    var reader = new FileReader();

    reader.onload = function(e) {
      ctrl.importXML(e.target.result);
    };

    reader.readAsText(file);
    return false;
  };

  // Session Event handlers
  // --------
  //

  this.onStateChanged = function() {
    var state = this.controller.state;
    if (state.context === "reader") {
      this.openReader();
    } else {
      console.log("Unknown application state: " + state);
    }
  };

  this.startLoading = function(msg) {
    if (!msg) msg = "Loading";
    $('.spinner-wrapper .message').html(msg);
    $('body').addClass('loading');
  };

  this.stopLoading = function() {
    $('body').removeClass('loading');
  };


  // Open the reader view
  // ----------
  //

  this.openReader = function() {
    var view = this.controller.reader.createView();
    var that = this;

    that.replaceMainView('reader', view);
    that.startLoading("Typesetting");

    this.$('#main').css({opacity: 0});

    _.delay(function() {
      that.stopLoading();
      that.$('#main').css({opacity: 1});
    }, 1000);
  };

  // Rendering
  // ==========================================================================
  //

  this.replaceMainView = function(name, view) {
    $('body').removeClass().addClass('current-view '+name);

    if (this.mainView && this.mainView !== view) {
      this.mainView.dispose();
    }

    this.mainView = view;
    this.$('#main').html(view.render().el);
  };

  this.render = function() {
    this.el.innerHTML = "";

    // Browser not supported dialogue
    // ------------

    this.el.appendChild($$('.browser-not-supported', {
      text: "Sorry, your browser is not supported.",
      style: "display: none;"
    }));

    // Spinner
    // ------------

    this.el.appendChild($$('.spinner-wrapper', {
      children: [
        $$('.spinner'),
        $$('.message', {html: 'Loading'})
      ]
    }));

    // Main container
    // ------------

    this.el.appendChild($$('#main'));
    return this;
  };

  this.dispose = function() {
    this.stopListening();
    if (this.mainView) this.mainView.dispose();
  };
};


// Export
// --------

LensView.Prototype.prototype = View.prototype;
LensView.prototype = new LensView.Prototype();

module.exports = LensView;
},{"../substance/application":173,"underscore":198}],151:[function(require,module,exports){
"use strict";

var Panel = require('./panel');
var ContainerPanelController = require('./container_panel_controller');

var ContainerPanel = function( config ) {
  Panel.call(this, config);
};
ContainerPanel.Prototype = function() {
  this.createController = function(doc) {
    return new ContainerPanelController(doc, this.config);
  };
};
ContainerPanel.Prototype.prototype = Panel.prototype;
ContainerPanel.prototype = new ContainerPanel.Prototype();

module.exports = ContainerPanel;

},{"./container_panel_controller":152,"./panel":160}],152:[function(require,module,exports){
"use strict";

var Document = require('../../substance/document');
var PanelController = require('./panel_controller');
var ResourcePanelViewFactory = require('./resource_panel_viewfactory');
var ContainerPanelView = require('./container_panel_view');

var ContainerPanelController = function( doc, config ) {
  PanelController.call(this, doc, config);
  this.docCtrl = new Document.Controller( doc, { view: config.container } );
};
ContainerPanelController.Prototype = function() {

  this.createView = function() {
    var doc = this.getDocument();
    var viewFactory;
    if (this.config.type === 'resource') {
      if (this.config.createViewFactory) {
        viewFactory = this.config.createViewFactory(doc, this.config);
      } else {
        viewFactory = new ResourcePanelViewFactory(doc.nodeTypes, this.config);
      }
    } else {
      var DefaultViewFactory = doc.constructor.ViewFactory;
      viewFactory = new DefaultViewFactory(doc.nodeTypes, this.config);
    }
    this.viewFactory = viewFactory;
    return new ContainerPanelView(this, viewFactory, this.config);
  };

  this.getContainer = function() {
    return this.docCtrl.getContainer();
  };

};
ContainerPanelController.Prototype.prototype = PanelController.prototype;
ContainerPanelController.prototype = new ContainerPanelController.Prototype();

module.exports = ContainerPanelController;

},{"../../substance/document":186,"./container_panel_view":153,"./panel_controller":161,"./resource_panel_viewfactory":163}],153:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var Scrollbar = require("./surface_scrollbar");
var Surface = require("../lens_surface");
var PanelView = require("./panel_view");
var getRelativeBoundingRect = require('../../substance/util/getRelativeBoundingRect');

// TODO: try to get rid of DocumentController and use the Container node instead
var ContainerPanelView = function( panelCtrl, viewFactory, config ) {
  PanelView.call(this, panelCtrl, config);

  this.surface = new Surface( panelCtrl.docCtrl, {
    editable: false,
    viewFactory: viewFactory
  });
  this.docCtrl = panelCtrl.docCtrl;

  this.scrollbar = new Scrollbar(this.surface);

  this._onScroll = _.bind(this.onScroll, this);
  this.surface.$el.on('scroll', this._onScroll );

  this.surface.$el.addClass('resource-view').addClass(config.container);

  this.el.appendChild(this.surface.el);
  this.el.appendChild(this.scrollbar.el);

  this.$activeResource = null;
};

ContainerPanelView.Prototype = function() {

  this.render = function() {
    // Hide the whole tab if there is no content
    if (this.getContainer().getLength() === 0) {
      this.hideToggle();
      this.hide();
    } else {
      this.surface.render();
      this.scrollbar.render();
    }
    return this;
  };

  this.getContainer = function() {
    return this.docCtrl.container;
  };

  this.onScroll = function() {
    this.scrollbar.onScroll();
  };

  this.hasScrollbar = function() {
    return true;
  };

  this.scrollTo = function(nodeId) {
    var n = this.findNodeView(nodeId);
    if (n) {
      var panelHeight = this.surface.$el.height();
      var screenTop = this.surface.$el.scrollTop();
      var screenBottom = screenTop + panelHeight;
      var elRect = getRelativeBoundingRect([n], this.surface.$nodes[0]);
      var elHeight = elRect.height;

      var upperBound = elRect.top; // top-offset of upper bound to relative parent
      var lowerBound = upperBound+elRect.height; // top-offset of lower bound to relative parent

      // Do not scroll if the element is fully visible
      if (upperBound>=screenTop && lowerBound <= screenBottom) {
        return;
      }

      this.surface.$el.scrollTop(upperBound);
      this.scrollbar.update();
    } else {
      console.info("ContainerPanelView.scrollTo(): Unknown resource '%s'", nodeId);
    }
  };

  this.findNodeView = function(nodeId) {
    return this.surface.findNodeView(nodeId);
  };

  this.addHighlight = function(id, classes) {
    PanelView.prototype.addHighlight.call(this, id, classes);
    var node = this.getDocument().get(id);
    if (node) this.scrollbar.addHighlight(id, classes + " " + node.type);
  };

  this.removeHighlights = function() {
    PanelView.prototype.removeHighlights.call(this);
    this.scrollbar.removeHighlights();
    this.scrollbar.update();
  };

  // call this after you finsihed adding/removing highlights
  this.update = function() {
    this.scrollbar.update();
  };

  this.hide = function() {
    if (this.hidden) return;
    PanelView.prototype.hide.call(this);
  };

  this.show = function() {
    this.scrollbar.update();
    PanelView.prototype.show.call(this);
  };

};

ContainerPanelView.Prototype.prototype = PanelView.prototype;
ContainerPanelView.prototype = new ContainerPanelView.Prototype();
ContainerPanelView.prototype.constructor = ContainerPanelView;

module.exports = ContainerPanelView;

},{"../../substance/util/getRelativeBoundingRect":193,"../lens_surface":149,"./panel_view":162,"./surface_scrollbar":164,"underscore":198}],154:[function(require,module,exports){
"use strict";

var ContainerPanel = require('../container_panel');
var ContentPanelController = require('./content_panel_controller');

var ContentPanel = function() {
  ContainerPanel.call(this, {
    name: "content",
    type: "document",
    container: "content",
    label: 'Contents',
    title: locales.Contents,
    icon: 'fa-align-left',
  });
};
ContentPanel.Prototype = function() {
  this.createController = function(doc) {
    return new ContentPanelController(doc, this.config);
  };
};
ContentPanel.Prototype.prototype = ContainerPanel.prototype;
ContentPanel.prototype = new ContentPanel.Prototype();

module.exports = ContentPanel;

},{"../container_panel":151,"./content_panel_controller":155}],155:[function(require,module,exports){
"use strict";

var ContainerPanelController = require('../container_panel_controller');
var ContentPanelView = require('./content_panel_view');

var ContentPanelController = function(doc, config) {
  ContainerPanelController.call(this, doc, config);
};
ContentPanelController.Prototype = function() {
  this.createView = function() {
    if (!this.view) {
      var doc = this.getDocument();
      var DefaultViewFactory = doc.constructor.ViewFactory;
      var viewFactory = new DefaultViewFactory(doc.nodeTypes, this.config);
      this.view = new ContentPanelView(this, viewFactory, this.config);
    }
    return this.view;
  };
};
ContentPanelController.Prototype.prototype = ContainerPanelController.prototype;
ContentPanelController.prototype = new ContentPanelController.Prototype();

module.exports = ContentPanelController;

},{"../container_panel_controller":152,"./content_panel_view":156}],156:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var ContainerPanelView = require('../container_panel_view');
var TocPanelView = require("./toc_panel_view");

var CORRECTION = 0; // Extra offset from the top

/* Adding + 1 pixel solves an edge case where clicking on a
   TOC item did not mark it as active, but the previous one */
var MENU_BAR_HEIGHT = 1; 

var ContentPanelView = function( panelCtrl, viewFactory, config ) {
  ContainerPanelView.call(this, panelCtrl, viewFactory, config);

  this.tocView = new TocPanelView(panelCtrl, viewFactory, _.extend({}, config, { type: 'resource', name: 'toc' }));
  // cache the elements of all toc nodes to allow an efficient implementation
  // of a scroll-spy in the TOC
  this.tocNodeElements = {};

  this._onTocItemSelected = _.bind( this.onTocItemSelected, this );

  // TODO: we should provide this index 'by default', as it is required by other (node/panel) views, too
  this.resources = panelCtrl.getDocument().addIndex('referenceByTarget', {
    types: ["resource_reference"],
    property: "target"
  });

  this.tocView.toc.on('toc-item-selected', this._onTocItemSelected);

  this.$el.addClass('document');
};

ContentPanelView.Prototype = function() {

  this.dispose = function() {
    this.tocView.toc.off('toc-item-selected', this._onTocItemSelected);
    this.stopListening();
  };

  this.getTocView = function() {
    return this.tocView;
  };

  // On Scroll update outline and mark active heading
  // --------
  //

  this.onScroll = function() {
    var scrollTop = this.surface.$el.scrollTop();
    this.scrollbar.update();
    this.markActiveHeading(scrollTop);
  };

  // Jump to the given node id
  // --------
  //

  this.onTocItemSelected = function(nodeId) {
    var n = this.findNodeView(nodeId);
    if (n) {
      n.scrollIntoView();
    }
  };

  // Mark active heading / TOC node (~ scroll-spy)
  // --------
  //

  this.markActiveHeading = function(scrollTop) {
    // scrollTop = scrollTop - 30;
    var contentHeight = $('.nodes').height();
    var tocNodes = this.getDocument().getTocNodes();

    var _getTocNodeElement = function(id) {
      var el = this.tocNodeElements[id];
      if (!el) {
        el = this.tocNodeElements[id] = this.findNodeView(id);
      }
      return el;
    }.bind(this);

    // No toc items?
    if (tocNodes.length === 0) return;

    var activeNode;
    var firstEl = _getTocNodeElement(tocNodes[0].id);

    // default
    activeNode = tocNodes[0].id;

    // and select the last item (once we reach the end of the doc)
    if (scrollTop + this.$el.height() >= contentHeight) {
      activeNode = _.last(tocNodes).id;
    }
    // starting from the end of document find the first node which is above the
    // current scroll position
    else {
      // TODO: maybe this could be optimized by a binary search
      for (var i = tocNodes.length - 1; i >= 1; i--) {
        var tocNode = tocNodes[i];
        var el = _getTocNodeElement(tocNode.id);
        if (!el) {
          console.error('Could not find element for node %s', tocNode.id);
          continue;
        }
        
        // HACK: we subtract height of menu bar so marking of active nodes stays accurate
        var elTopOffset = $(el).offset().top - MENU_BAR_HEIGHT;
        if (elTopOffset <= 0) {
          activeNode = el.dataset.id;
          break;
        }
      }
    }
    this.tocView.setActiveNode(activeNode);
  };

  this.markReferencesTo = function(target) {
    // Mark all annotations that reference the resource
    var annotations = this.resources.get(target);
    _.each(annotations, function(a) {
      $(this.findNodeView(a.id)).addClass('active');
    }, this);
  };

  this.removeHighlights = function() {
    ContainerPanelView.prototype.removeHighlights.call(this);
    this.$el.find('.content-node.active').removeClass('active');
    this.$el.find('.annotation.active').removeClass('active');
  };

};
ContentPanelView.Prototype.prototype = ContainerPanelView.prototype;
ContentPanelView.prototype = new ContentPanelView.Prototype();
ContentPanelView.prototype.constructor = ContentPanelView;

module.exports = ContentPanelView;
},{"../container_panel_view":153,"./toc_panel_view":158,"underscore":198}],157:[function(require,module,exports){

module.exports = require('./content_panel');

},{"./content_panel":154}],158:[function(require,module,exports){
"use strict";

var TOCView = require("./toc_view");
var PanelView = require("../panel_view");

var TocPanelView = function( panelCtrl, viewFactory, config ) {
  PanelView.call(this, panelCtrl, config);
  this.toc = new TOCView(panelCtrl.getDocument(), viewFactory);
};
TocPanelView.Prototype = function() {

  this.render = function() {
    this.el.appendChild(this.toc.render().el);
    return this;
  };

  // Delegate
  this.setActiveNode = function(nodeId) {
    this.toc.setActiveNode(nodeId);
  };

  this.onToggle = function(e) {
    this.trigger('toggle', "toc");
    e.preventDefault();
    e.stopPropagation();
  };
};
TocPanelView.Prototype.prototype = PanelView.prototype;
TocPanelView.prototype = new TocPanelView.Prototype();
TocPanelView.prototype.constructor = TocPanelView;

module.exports =  TocPanelView;

},{"../panel_view":162,"./toc_view":159}],159:[function(require,module,exports){
"use strict";

var View = require("../../../substance/application").View;
var $$ = require("../../../substance/application").$$;
var Data = require("../../../substance/data");
var Index = Data.Graph.Index;
var _ = require("underscore");

// Substance.TOC.View
// ==========================================================================

var TOCView = function(doc, viewFactory) {
  View.call(this);
  this.doc = doc;
  this.viewFactory = viewFactory;
  this.$el.addClass("toc");
};

TOCView.Prototype = function() {

  // Renderer
  // --------

  this.render = function() {
    var lastLevel = -1;
    var tocNodes = this.doc.getTocNodes();

    // don't render if only 2 sections

    var backLinkContainer = document.createElement('div');
    backLinkContainer.setAttribute('class','navigation');
    var backLink = document.createElement('a');
    var linkUrl = '';
    backLink.setAttribute('href',linkUrl);
    backLink.textContent =locales.Back;
    backLinkContainer.appendChild(backLink);
   // this.el.appendChild(backLinkContainer);

    // TODO: this should be decided by the toc panel
    if (tocNodes.length < 2) return this;

    _.each(tocNodes, function(node) {
      var nodeView = this.viewFactory.createView(node);
      var level = node.getLevel();
      if (level < 5) {
        if (level === -1) {
          level = lastLevel + 1;
        } else {
          lastLevel = level;
        }
        var el = nodeView.renderTocItem();
        var $el = $(el);
        el.id = "toc_" + node.id;
        // TODO: change 'heading-ref' to 'toc-node'
        $el.addClass('heading-ref');
        $el.addClass('level-' + level);
        $el.click(_.bind(this.onClick, this, node.id));
        this.el.appendChild(el);


      }
    }, this);

    return this;
  };

  // Renderer
  // --------
  //

  this.setActiveNode = function(nodeId) {
    this.$('.heading-ref.active').removeClass('active');
    this.$('#toc_'+nodeId).addClass('active');
  };

  this.onClick = function(headingId) {
    this.trigger('toc-item-selected', headingId)
  };
};

TOCView.Prototype.prototype = View.prototype;
TOCView.prototype = new TOCView.Prototype();

module.exports = TOCView;

},{"../../../substance/application":173,"../../../substance/data":179,"underscore":198}],160:[function(require,module,exports){
"use strict";

var Panel = function(config) {
  this.config = config;
  this.config.label = config.title;
};

Panel.Prototype = function() {

  /* jshint unused:false */

  this.createController = function(doc) {
    throw new Error("this method is abstract");
  };

  this.getName = function() {
    return this.config.name;
  };

  this.getConfig = function() {
    return this.config;
  };

};
Panel.prototype = new Panel.Prototype();
Panel.prototype.constructor = Panel;

module.exports = Panel;

},{}],161:[function(require,module,exports){
"use strict";
var Controller = require("../../substance/application").Controller;
var _ = require("underscore");
var util = require("../../substance/util");


// Panel.Controller
// -----------------
//
// Controls a panel

var PanelController = function(document, config) {
  this.document = document;
  this.config = config;
};

PanelController.Prototype = function() {
  var __super__ = Controller.prototype;

  this.createView = function() {
    throw new Error("this is an abstract method");
  };

  this.getConfig = function() {
    return this.config;
  };

  this.getName = function() {
    return this.config.name;
  };

  this.getDocument = function() {
    return this.document;
  };

};

PanelController.Prototype.prototype = Controller.prototype;
PanelController.prototype = new PanelController.Prototype();

module.exports = PanelController;

},{"../../substance/application":173,"../../substance/util":195,"underscore":198}],162:[function(require,module,exports){
var _ = require('underscore');

var Application = require("../../substance/application");
var $$ = Application.$$;
var View = Application.View;

var PanelView = function(panelController, config) {
  View.call(this);

  this.controller = panelController;
  this.config = config;
  this.doc = panelController.getDocument();
  this.name = config.name;

  this.toggleEl = $$('a.context-toggle.' + this.name, {
    'href': '#',
    'title': this.config.title,
    'html': '<i class="fa ' + this.config.icon + '"></i> '+this.config.title
  });
  this.$toggleEl = $(this.toggleEl);

  this.$el.addClass('panel').addClass(this.name);

  // For legacy add 'resource-view' class
  if (this.config.type === 'resource') {
    this.$el.addClass('resource-view');
  }


  // Events

  this._onToggle = _.bind( this.onToggle, this );
  this._onToggleResource = _.bind( this.onToggleResource, this );
  this._onToggleResourceReference = _.bind( this.onToggleResourceReference, this );
  this._onToggleFullscreen = _.bind( this.onToggleFullscreen, this);

  this.$toggleEl.click( this._onToggle );
  this.$el.on('click', '.action-toggle-resource', this._onToggleResource);
  this.$el.on('click', '.toggle-fullscreen', this._onToggleFullscreen);
  this.$el.on('click', '.annotation.resource-reference', this._onToggleResourceReference);

  // we always keep track of nodes that have are highlighted ('active', 'focussed')
  this.highlightedNodes = [];
};

PanelView.Prototype = function() {

  this.dispose = function() {
    this.$toggleEl.off('click', this._onClick);
    this.$el.off('scroll', this._onScroll);
    this.$el.off('click', '.a.action-toggle-resource', this._onToggleResource);
    this.$el.off('click', '.a.toggle-fullscreen', this._onToggleFullscreen);
    this.$el.off('click', '.annotation.reference', this._onToggleResourceReference);
    this.stopListening();
  };

  this.onToggle = function(e) {
    this.trigger('toggle', this.name);
    e.preventDefault();
    e.stopPropagation();
  };

  this.getToggleControl = function() {
    return this.toggleEl;
  };

  this.hasScrollbar = function() {
    return false;
  };

  this.show = function() {
    this.$el.removeClass('hidden');
    this.hidden = false;
  };

  this.hide = function() {
    if (this.hidden) return;
    this.$el.addClass('hidden');
    this.$toggleEl.removeClass('active');
    this.hidden = true;
  };

  this.isHidden = function() {
    return this.hidden;
  };

  this.activate = function() {
    this.show();
    $('#main .article')[0].dataset.context = this.name;
    this.$toggleEl.addClass('active');
  };

  this.addHighlight = function(id, cssClass) {
    // console.log("Add highlight for", id, cssClass);
    var nodeEl = this.findNodeView(id);
    if (nodeEl) {
      var $nodeEl = $(nodeEl);
      $nodeEl.addClass(cssClass);
      this.highlightedNodes.push({
        $el: $nodeEl,
        cssClass: cssClass
      });
    }
  };

  this.removeHighlights = function() {
    // console.log("Removing highlights from panel ", this.name);
    for (var i = 0; i < this.highlightedNodes.length; i++) {
      var highlighted = this.highlightedNodes[i];
      highlighted.$el.removeClass(highlighted.cssClass);
    }
    this.highlightedNodes = [];
  };

  this.showToggle = function() {
    this.$toggleEl.removeClass('hidden');
  };

  this.hideToggle = function() {
    this.$toggleEl.addClass('hidden');
  };

  this.getDocument = function() {
    return this.doc;
  };

  this.findNodeView = function(nodeId) {
    return this.el.querySelector('*[data-id='+nodeId+']');
  };

  // Event handling
  // --------
  //

  this.onToggleResource = function(event) {
    event.preventDefault();
    event.stopPropagation();
    var element = $(event.currentTarget).parents('.content-node')[0];
    var id = element.dataset.id;
    this.trigger("toggle-resource", this.name, id, element);
  };

  this.onToggleResourceReference = function(event) {
    event.preventDefault();
    event.stopPropagation();
    var element = event.currentTarget;
    var refId = event.currentTarget.dataset.id;
    this.trigger("toggle-resource-reference", this.name, refId, element);
  };

  this.onToggleFullscreen = function(event) {
    event.preventDefault();
    event.stopPropagation();
    var element = $(event.currentTarget).parents('.content-node')[0];
    var id = element.dataset.id;
    this.trigger("toggle-fullscreen", this.name, id, element);
  };

};

PanelView.Prototype.prototype = View.prototype;
PanelView.prototype = new PanelView.Prototype();
PanelView.prototype.constructor = PanelView;

module.exports = PanelView;

},{"../../substance/application":173,"underscore":198}],163:[function(require,module,exports){

var ViewFactory = require('../../article').ViewFactory;

var ResourcePanelViewFactory = function(nodeTypes, options) {
  ViewFactory.call(this, nodeTypes);
  this.options = options || {};

  if (this.options.header === undefined) this.options.header = true;
  if (this.options.zoom === undefined) this.options.zoom = ResourcePanelViewFactory.enableZoom;

};

ResourcePanelViewFactory.Prototype = function() {

  this.createView = function(node, options, type) {
    options = options || {};
    var NodeView = this.getNodeViewClass(node, type);
    if (options.topLevel && NodeView.prototype.isResourceView && this.options.header) {
      options.header = true;
      if (NodeView.prototype.isZoomable && this.options.zoom) {
        options.zoom = true;
      }
    }
    // Note: passing the factory to the node views
    // to allow creation of nested views
    var nodeView = new NodeView(node, this, options);
    return nodeView;
  };

};
ResourcePanelViewFactory.Prototype.prototype = ViewFactory.prototype;
ResourcePanelViewFactory.prototype = new ResourcePanelViewFactory.Prototype();

ResourcePanelViewFactory.enableZoom = false;

module.exports = ResourcePanelViewFactory;

},{"../../article":5}],164:[function(require,module,exports){
"use strict";

var View = require("../../substance/application").View;
var $$ = require("../../substance/application").$$;
var _ = require("underscore");

// Lens.Scrollbar
// ==========================================================================
//
// A custom scrollbar which allows to add overlays which are rendered at the same
// y-position as their reference elements in the surface.

var Scrollbar = function(surface) {
  View.call(this);

  this.surface = surface;

  // initialized on first update
  this.$nodes = this.surface.$nodes;

  this.$el.addClass('surface-scrollbar');
  this.$el.addClass(surface.docCtrl.getContainer().id);

  this.overlays = [];

  _.bindAll(this, 'mouseDown', 'mouseUp', 'mouseMove', 'updateVisibleArea');

  // Mouse event handlers
  // --------

  this.$el.mousedown(this.mouseDown);

  $(window).mousemove(this.mouseMove);
  $(window).mouseup(this.mouseUp);
};

Scrollbar.Prototype = function() {

  // Render Document Scrollbar
  // -------------
  //
  // Renders outline and calculates bounds

  this.render = function() {
    var contentHeight = this.$nodes.height();
    var panelHeight = this.surface.$el.height();
    this.factor = (contentHeight / panelHeight);
    this.visibleArea = $$('.visible-area');
    // Init scroll pos
    this.scrollTop = this.surface.$el.scrollTop();
    this.el.innerHTML = "";
    this.el.appendChild(this.visibleArea);
    this.updateVisibleArea();
    return this;
  };


  // Update visible area
  // -------------
  //
  // Should get called from the user when the content area is scrolled

  this.updateVisibleArea = function() {
    $(this.visibleArea).css({
      "top": this.scrollTop / this.factor,
      "height": this.surface.$el.height() / this.factor
    });
  };

  this.addOverlay = function(el) {
    // We need to store the surface node element together with overlay element
    //
    var $overlay = $('<div>').addClass('node overlay');
    this.overlays.push({ el: el, $overlay: $overlay });
    this.$el.append($overlay);
    return $overlay;
  };

  this.updateOverlay = function(el, $overlay) {
    var $el = $(el);
    var height = $el.outerHeight(true) / this.factor;
    var top = ($el.offset().top - this.surfaceTop) / this.factor;
    // HACK: make all highlights at least 3 pxls high, and centered around the desired top pos
    if (height < Scrollbar.OverlayMinHeight) {
      height = Scrollbar.OverlayMinHeight;
      top = top - 0.5 * Scrollbar.OverlayMinHeight;
    }
    $overlay.css({
        "height": height,
        "top": top
      });
  };

  // Add highlights to scrollbar
  // -------------
  //

  this.addHighlight = function(nodeId, classes) {
    var nodeEl = this.surface.findNodeView(nodeId);
    if (!nodeEl) {
      // Note: this happens on a regular basis, as very often we ask e.g. the index to give
      // all annotation targeting to a resource. But the reference itself does not necessarily be part of
      // this surface
      return;
    }
    var $overlay = this.addOverlay(nodeEl);
    this.updateOverlay(nodeEl, $overlay);
    $overlay.addClass(classes);
    return $overlay[0];
  };

  this.addHighlights = function(nodeIds, classes) {
    var overlayEls = [];
    for (var i = 0; i < nodeIds.length; i++) {
      var overlayEl = this.addHighlight(nodeIds[i], classes);
      overlayEls.push(overlayEl);
    }
    this.update();
    return overlayEls;
  };

  this.removeHighlights = function() {
    for (var i = 0; i < this.overlays.length; i++) {
      var overlay = this.overlays[i];
      overlay.$overlay.remove();
    }
  };

  this.update = function() {
    // initialized lazily as this element is not accessible earlier (e.g. during construction)
    // get the new dimensions
    var contentHeight = this.$nodes.height();
    var panelHeight = this.surface.$el.height();

    if (contentHeight > panelHeight) {
      $(this.el).removeClass('hidden');
    } else {
      $(this.el).addClass('hidden');
    }

    // console.log("Scrollbar.update()", contentHeight, panelHeight);
    this.factor = (contentHeight / panelHeight);
    this.surfaceTop = this.$nodes.offset().top;
    this.scrollTop = this.surface.$el.scrollTop();
    this.updateVisibleArea();
    for (var i = 0; i < this.overlays.length; i++) {
      var overlay = this.overlays[i];
      this.updateOverlay(overlay.el, overlay.$overlay);
    }
  };

  // Handle Mouse down event
  // -----------------
  //

  this.mouseDown = function(e) {
    this._mouseDown = true;
    var y = e.pageY;
    if (e.target !== this.visibleArea) {
      // Jump to mousedown position
      this.offset = $(this.visibleArea).height()/2;
      this.mouseMove(e);
    } else {
      this.offset = y - $(this.visibleArea).position().top;
    }
    return false;
  };

  // Handle Mouse Up
  // -----------------
  //
  // Mouse lifted, no scroll anymore

  this.mouseUp = function() {
    this._mouseDown = false;
  };

  // Handle Scroll
  // -----------------
  //
  // Handle scroll event
  // .visible-area handle

  this.mouseMove = function(e) {
    if (this._mouseDown) {
      var y = e.pageY;
      // find offset to visible-area.top
      var scroll = (y-this.offset)*this.factor;
      this.scrollTop = this.surface.$el.scrollTop(scroll);
      this.updateVisibleArea();
    }
  };

  this.onScroll = function() {
    if (this.surface) {
      this.scrollTop = this.surface.$el.scrollTop();
      this.updateVisibleArea();
    }
  };

};

Scrollbar.Prototype.prototype = View.prototype;
Scrollbar.prototype = new Scrollbar.Prototype();

Scrollbar.OverlayMinHeight = 5;

module.exports = Scrollbar;

},{"../../substance/application":173,"underscore":198}],165:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var Controller = require("../substance/application").Controller;
var ReaderView = require("./reader_view");
var ContentPanel = require("./panels/content");

// Reader.Controller
// -----------------
//
// Controls the Reader.View

var ReaderController = function(doc, state, options) {

  // Private reference to the document
  this.__document = doc;

  this.options = options || {};

  this.panels = options.panels;
  this.contentPanel = new ContentPanel(doc);

  // create panel controllers
  this.panelCtrls = {};
  this.panelCtrls['content'] = this.contentPanel.createController(doc);
  _.each(this.panels, function(panel) {
    this.panelCtrls[panel.getName()] = panel.createController(doc);
  }, this);

  this.workflows = options.workflows || [];

  this.state = state;

  // Current explicitly set panel
  this.currentPanel = "toc";
};

ReaderController.Prototype = function() {

  this.createView = function() {
    if (!this.view) this.view = new ReaderView(this);
    return this.view;
  };

  // Explicit panel switch
  // --------
  //

  this.switchPanel = function(panel) {
    this.currentPanel = panel;
    this.modifyState({
      panel: panel,
      focussedNode: null,
      fullscreen: false
    });
  };

  this.getDocument = function() {
    return this.__document;
  };
};

ReaderController.Prototype.prototype = Controller.prototype;
ReaderController.prototype = new ReaderController.Prototype();

module.exports = ReaderController;

},{"../substance/application":173,"./panels/content":157,"./reader_view":166,"underscore":198}],166:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var View = require("../substance/application").View;
var Data = require("../substance/data");
var Index = Data.Graph.Index;
var $$ = require("../substance/application").$$;

// Lens.Reader.View
// ==========================================================================
//

var ReaderView = function (readerCtrl) {
    View.call(this);

    // Controllers
    // --------

    this.readerCtrl = readerCtrl;
    this.doc = this.readerCtrl.getDocument();

    this.$el.addClass('article');
    this.$el.addClass(this.doc.schema.id); // Substance article or lens article?

    // Stores latest body scroll positions per panel

    this.bodyScroll = {};

    // Panels
    // ------
    // Note: ATM, it is not possible to override the content panel + toc via panelSpecification
    this.contentView = readerCtrl.panelCtrls.content.createView();
    this.tocView = this.contentView.getTocView();
    this.panelViews = {};
    // mapping to associate reference types to panels
    // NB, in Lens each resource type has one dedicated panel;
    // clicking on a reference opens this panel
    this.panelForRef = {};

    _.each(readerCtrl.panels, function (panel) {
        var name = panel.getName();
        var panelCtrl = readerCtrl.panelCtrls[name];
        this.panelViews[name] = panelCtrl.createView();
        _.each(panel.config.references, function (refType) {
            this.panelForRef[refType] = name;
        }, this);
    }, this);
    this.panelViews['toc'] = this.tocView;

    // Keep an index for resources
    this.resources = new Index(this.readerCtrl.getDocument(), {
        types: ["resource_reference"],
        property: "target"
    });

    // whenever a workflow takes control set this variable
    // to be able to call it a last time when switching to another
    // workflow
    this.lastWorkflow = null;
    this.lastPanel = "toc";

    // Events
    // --------
    //

    this._onTogglePanel = _.bind(this.switchPanel, this);

    // Whenever a state change happens (e.g. user navigates somewhere)
    // the interface gets updated accordingly
    this.listenTo(this.readerCtrl, "state-changed", this.updateState);

    this.listenTo(this.tocView, 'toggle', this._onTogglePanel);
    _.each(this.panelViews, function (panelView) {
        this.listenTo(panelView, "toggle", this._onTogglePanel);
        this.listenTo(panelView, "toggle-resource", this.onToggleResource);
        this.listenTo(panelView, "toggle-resource-reference", this.onToggleResourceReference);
        this.listenTo(panelView, "toggle-fullscreen", this.onToggleFullscreen);
    }, this);

    // TODO: treat content panel as panelView and delegate to tocView where necessary
    this.listenTo(this.contentView, "toggle", this._onTogglePanel);
    this.listenTo(this.contentView, "toggle-resource", this.onToggleResource);
    this.listenTo(this.contentView, "toggle-resource-reference", this.onToggleResourceReference);
    this.listenTo(this.contentView, "toggle-fullscreen", this.onToggleFullscreen);

    // attach workflows
    _.each(this.readerCtrl.workflows, function (workflow) {
        workflow.attach(this.readerCtrl, this);
    }, this);


    // attach a lazy/debounced handler for resize events
    // that updates the outline of the currently active panels
    $(window).resize(_.debounce(_.bind(function () {
        this.contentView.scrollbar.update();
        var currentPanel = this.panelViews[this.readerCtrl.state.panel];
        if (currentPanel && currentPanel.hasScrollbar()) {
            currentPanel.scrollbar.update();
        }
    }, this), 1));

};

ReaderView.Prototype = function () {


    // Rendering
    // --------
    //

    this.render = function () {
        var frag = document.createDocumentFragment();

        // Prepare doc view
        // --------

        frag.appendChild(this.contentView.render().el);

        // Scrollbar cover
        // This is only there to cover the content panel's scrollbar in Firefox.
        var scrollbarCover = $$('.scrollbar-cover');
        var A = parseInt($('.panel.content.document').width(), 10);
        var B = parseInt($('.surface.resource-view.content').width(), 10);
        var Z = parseInt($('.scrollbar-cover').width(), 10);
        var minw = parseInt((A + B + Z) * 10 / 100, 10);

        var offset = $('.scrollbar-cover').offset();
        console.log($(".surface.resource-view.content"));
        var E = $(".surface.resource-view.content");
        console.log(A, B, Z, minw,offset);

        function getAllMethods(object) {
            return Object.getOwnPropertyNames(object).filter(function(property) {
                return typeof object[property] == 'function';
            });
        }

        //console.log(getAllMethods(E));

    /**
        $(".scrollbar-cover").draggable({
            axis : 'x',
            containment : [
                offset.left + minw,
                offset.top,
                offset.left + A + B - minw,
                offset.top + $('#container').height()
            ],
            drag : console.log(minw)
        });
     /**

        /**
        $( function() {
            $('.scrollbar-cover').draggable({
                //containment: "parent",
                click: function () {
                    var position = $(".scrollbar-cover").position();
                    var parentWidth = $(".panel.content.document").width();
                    var percentage = "%";
                    var percentagePositi
                    on = (position.left / parentWidth) * 100;
                    var negativePosition = parentWidth - position.left;
                    var negativePercentagePosition = (negativePosition / parentWidth) * 100;
                    $(".surface.resource-view.content").outerWidth(percentagePosition + percentage);
                    $(".resources").outerWidth((negativePercentagePosition) + percentage);
                    console.log("sss");
                }
            });
        });
         **/


        this.contentView.el.appendChild(scrollbarCover);

        // Prepare panel toggles
        // --------

        var panelToggles = $$('.context-toggles');
        panelToggles.appendChild(this.tocView.getToggleControl());
        this.tocView.on('toggle', this._onClickPanel);
        _.each(this.readerCtrl.panels, function (panel) {
            var panelView = this.panelViews[panel.getName()];
            var toggleEl = panelView.getToggleControl();
            panelToggles.appendChild(toggleEl);
            panelView.on('toggle', this._onClickPanel);
        }, this);

        // Prepare panel views
        // -------

        // Wrap everything within resources view
        var resourcesViewEl = $$('.resources');
        resourcesViewEl.appendChild(this.tocView.render().el);
        _.each(this.readerCtrl.panels, function (panel) {
            var panelView = this.panelViews[panel.getName()];
            // console.log('Rendering panel "%s"', name);
            resourcesViewEl.appendChild(panelView.render().el);
        }, this);

        var menuBar = $$('.menu-bar');

        menuBar.appendChild(panelToggles);
        resourcesViewEl.appendChild(menuBar);
        frag.appendChild(resourcesViewEl);

        this.el.appendChild(frag);


        // TODO: also update the outline after image (et al.) are loaded

        // Postpone things that expect this view has been inserted into the DOM already.
        _.delay(_.bind(function () {
            // initial state update here as scrollTo would not work out of DOM
            this.updateState();

            var self = this;
            // MathJax requires the processed elements to be in the DOM
            if (window.MathJax) {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
                window.MathJax.Hub.Queue(function () {
                    // HACK: using updateState() instead of updateScrollbars() as it also knows how to scroll
                    self.updateState();
                });
            }
        }, this), 1);

        return this;
    };

    // Free the memory.
    // --------
    //

    this.dispose = function () {
        _.each(this.workflows, function (workflow) {
            workflow.detach();
        });

        this.contentView.dispose();
        _.each(this.panelViews, function (panelView) {
            panelView.off('toggle', this._onClickPanel);
            panelView.dispose();
        }, this);
        this.resources.dispose();
        this.stopListening();
    };

    this.getState = function () {
        return this.readerCtrl.state;
    };

    // Explicit panel switch
    // --------
    //
    // Only triggered by the explicit switch
    // Implicit panel switches happen when someone clicks a figure reference

    this.switchPanel = function (panel) {
        this.readerCtrl.switchPanel(panel);
        // keep this so that it gets opened when leaving another panel (toggling reference)
        this.lastPanel = panel;
    };

    // Update Reader State
    // --------
    //
    // Called every time the controller state has been modified
    // Search for readerCtrl.modifyState occurences

    this.updateState = function () {
        var self = this;
        var state = this.readerCtrl.state;

        var handled;

        // EXPERIMENTAL: introducing workflows to handle state updates
        // we extract some info to make it easier for workflows to detect if they
        // need to handle the state update.
        var stateInfo = {
            focussedNode: state.focussedNode ? this.doc.get(state.focussedNode) : null
        };

        var currentPanelView = state.panel === "content" ? this.contentView : this.panelViews[state.panel];

        _.each(this.panelViews, function (panelView) {
            if (!panelView.isHidden()) panelView.hide();
        });

        // Always deactivate previous highlights
        this.contentView.removeHighlights();

        // and also remove highlights from resource panels
        _.each(this.panelViews, function (panelView) {
            panelView.removeHighlights();
        });

        // Highlight the focussed node
        if (state.focussedNode) {
            var classes = ["focussed", "highlighted"];
            // HACK: abusing addHighlight for adding the fullscreen class
            // instead I would prefer to handle such focussing explicitely in a workflow
            if (state.fullscreen) classes.push("fullscreen");
            this.contentView.addHighlight(state.focussedNode, classes.concat('main-occurrence').join(' '));
            currentPanelView.addHighlight(state.focussedNode, classes.join(' '));
            currentPanelView.scrollTo(state.focussedNode);
        }

        // A workflow needs to take care of
        // 1. showing the correct panel
        // 2. setting highlights in the content panel
        // 3. setting highlights in the resource panel
        // 4. scroll panels
        // A workflow should have Workflow.handlesStateUpdates = true if it is interested in state updates
        // and should override Workflow.handleStateUpdate(state, info) to perform the update.
        // In case it has been responsible for the update it should return 'true'.

        // TODO: what is this exactly for?
        if (this.lastWorkflow) {
            handled = this.lastWorkflow.handleStateUpdate(state, stateInfo);
        }

        if (!handled) {
            // Go through all workflows and let them try to handle the state update.
            // Stop after the first hit.
            for (var i = 0; i < this.readerCtrl.workflows.length; i++) {
                var workflow = this.readerCtrl.workflows[i];
                // lastWorkflow had its chance already, so skip it here
                if (workflow !== this.lastWorkflow && workflow.handlesStateUpdate) {
                    handled = workflow.handleStateUpdate(state, stateInfo);
                    if (handled) {
                        this.lastWorkflow = workflow;
                        break;
                    }
                }
            }
        }

        // If not handled above, we at least show the correct panel
        if (!handled) {
            // Default implementation for states with a panel set
            if (state.panel !== "content") {
                var panelView = this.panelViews[state.panel];
                this.showPanel(state.panel);
                // if there is a resource focussed in the panel, activate the resource, and highlight all references to it in the content panel
                if (state.focussedNode) {
                    // get all references that point to the focussedNode and highlight them
                    var refs = this.resources.get(state.focussedNode);
                    _.each(refs, function (ref) {
                        this.contentView.addHighlight(ref.id, "highlighted ");
                        this.contentView.scrollTo(ref.target);
                    }, this);
                    // TODO: Jumps to wrong position esp. for figures, because content like images has not completed loading
                    // at that stage. WE should make corrections afterwards
                    if (panelView.hasScrollbar()) panelView.scrollTo(state.focussedNode);
                }
            } else {
                this.showPanel("toc");
            }
        }

        // HACK: Update the scrollbar after short delay
        // This was necessary after we went back to using display: none for hiding panels,
        // instead of visibility: hidden (caused problems with scrolling on iPad)
        // This hack should not be necessary if we can ensure that
        // - panel is shown first (so scrollbar can grab the dimensions)
        // - whenever the contentHeight changes scrollbars should be updated
        // - e.g. when an image completed loading

        self.updateScrollbars();
        _.delay(function () {
            self.updateScrollbars();
        }, 2000);
    };

    this.updateScrollbars = function () {
        var state = this.readerCtrl.state;
        // var currentPanelView = state.panel === "content" ? this.contentView : this.panelViews[state.panel];
        this.contentView.scrollbar.update();

        _.each(this.panelViews, function (panelView) {
            if (panelView.hasScrollbar()) panelView.scrollbar.update();
        });
        // if (currentPanelView && currentPanelView.hasScrollbar()) currentPanelView.scrollbar.update();
    };

    this.showPanel = function (name) {
        if (this.panelViews[name]) {
            this.panelViews[name].activate();
            this.el.dataset.context = name;
        } else if (name === "content") {
            this.panelViews.toc.activate();
            this.el.dataset.context = name;
        }
    };

    this.getPanelView = function (name) {
        return this.panelViews[name];
    };

    // Toggle (off) a resource
    // --------
    //

    this.onToggleResource = function (panel, id, element) {
        if (element.classList.contains('highlighted')) {
            this.readerCtrl.modifyState({
                panel: panel,
                focussedNode: null,
                fullscreen: false
            });
        } else {
            this.readerCtrl.modifyState({
                panel: panel,
                focussedNode: id
            });
        }
    };

    // Toggle (off) a reference
    // --------

    this.onToggleResourceReference = function (panel, id, element) {
        if (element.classList.contains('highlighted')) {
            this.readerCtrl.modifyState({
                panel: this.lastPanel,
                focussedNode: null,
                fullscreen: false
            });
        } else {
            // FIXME: ATM the state always assumes 'content' as the containing panel
            // Instead, we also let the panel catch the event and then delegate to ReaderView providing the context as done with onToggleResource
            this.readerCtrl.modifyState({
                panel: "content",
                focussedNode: id,
                fullscreen: false
            });
        }
    };

    this.onToggleFullscreen = function (panel, id) {
        var fullscreen = !this.readerCtrl.state.fullscreen;
        this.readerCtrl.modifyState({
            panel: panel,
            focussedNode: id,
            fullscreen: fullscreen
        });
    };

};

ReaderView.Prototype.prototype = View.prototype;
ReaderView.prototype = new ReaderView.Prototype();
ReaderView.prototype.constructor = ReaderView;

module.exports = ReaderView;

},{"../substance/application":173,"../substance/data":179,"underscore":198}],167:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var Workflow = require('./workflow');

var FollowCrossrefs = function() {
  Workflow.apply(this, arguments);

  this._followCrossReference = _.bind(this.followCrossReference, this);
};

FollowCrossrefs.Prototype = function() {

  this.registerHandlers = function() {
    this.readerView.$el.on('click', '.annotation.cross_reference', this._followCrossReference);
  };

  this.unRegisterHandlers = function() {
    this.readerView.$el.off('click', '.annotation.cross_reference', this._followCrossReference);
  };

    this.followCrossReference = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var refId = e.currentTarget.dataset.id;
        var crossRef = this.readerCtrl.getDocument().get(refId);
        var crossRefTarget;
        if (crossRef !==undefined) {
            if (crossRef.target !== undefined) {
                crossRefTarget = crossRef.target;
                this.readerView.contentView.scrollTo(crossRefTarget);
            }
            if (crossRefTarget === undefined) {
                if (crossRef.properties !== undefined) {
                    crossRefTarget = crossRef.properties.id;
                    this.readerView.contentView.scrollTo(crossRefTarget);
                }
            }
        }


    };

};
FollowCrossrefs.Prototype.prototype = Workflow.prototype;
FollowCrossrefs.prototype = new FollowCrossrefs.Prototype();

module.exports = FollowCrossrefs;

},{"./workflow":170,"underscore":198}],168:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var Workflow = require('./workflow');

var JumpToTop = function() {
  Workflow.apply(this, arguments);
  this._gotoTop = _.bind(this.gotoTop, this);
};


JumpToTop.Prototype = function() {

  this.registerHandlers = function() {
    this.readerView.$el.on('click', '.document .content-node.heading .top', this._gotoTop);
  };

  this.unRegisterHandlers = function() {
    this.readerView.$el.off('click', '.document .content-node.heading .top', this._gotoTop);
  };

  this.gotoTop = function() {
    e.preventDefault();
    e.stopPropagation();
    // Jump to cover node as that's easiest
    this.readerCtrl.contentView.jumpToNode("cover");
  };
};

JumpToTop.Prototype.prototype = Workflow.prototype;
JumpToTop.prototype = new JumpToTop.Prototype();

module.exports = JumpToTop;

},{"./workflow":170,"underscore":198}],169:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var Workflow = require('./workflow');

var ToggleResourceReference = function() {
  Workflow.apply(this, arguments);
};

ToggleResourceReference.Prototype = function() {

  this.registerHandlers = function() {
  };

  this.unRegisterHandlers = function() {
  };

  this.handlesStateUpdate = true;

  this.handleStateUpdate = function(state, stateInfo) {
    // if the reference type is registered with this workflow
    // open the panel and show highlights
    if (stateInfo.focussedNode && this.readerView.panelForRef[stateInfo.focussedNode.type]) {
      var ref = stateInfo.focussedNode;
      var panelName = this.readerView.panelForRef[ref.type];
      var panelView = this.readerView.panelViews[panelName];
      var contentView = this.readerView.contentView;
      var resourceId = ref.target;
      // show the associated panel, hihglight the resource and scroll to its position
      panelView.activate();
      var classes = ["highlighted"];
      panelView.addHighlight(resourceId, classes.join(" "));
      panelView.scrollTo(resourceId);
      // panelView.scrollbar.update();
      // highlight all other references in the content panel for the same resource
      var refs = this.readerView.resources.get(resourceId);
      delete refs[ref.id];
      _.each(refs, function(ref) {
        contentView.addHighlight(ref.id, "highlighted");
      }, this);
      return true;
    }
    return false;
  };

};
ToggleResourceReference.Prototype.prototype = Workflow.prototype;
ToggleResourceReference.prototype = new ToggleResourceReference.Prototype();

module.exports = ToggleResourceReference;

},{"./workflow":170,"underscore":198}],170:[function(require,module,exports){
"use strict";

var Workflow = function() {
  this.readerController = null;
  this.readerView = null;
};

Workflow.Prototype = function() {

  /* jshint unused:false */

  this.attach = function(readerController, readerView) {
    this.readerCtrl = readerController;
    this.readerView = readerView;
    this.registerHandlers();
  };

  this.detach = function() {
    this.unRegisterHandlers();
    this.readerView = null;
    this.readerController = null;
  };

  this.registerHandlers = function() {
    throw new Error('This method is abstract');
  };

  this.unRegisterHandlers = function() {
    throw new Error('This method is abstract');
  };

  // override this if state changes are relevant
  this.handlesStateUpdate = false;

  // override this method and return true if the state update is handled by this workflow
  this.handleStateUpdate = function(state, stateInfo) {
    throw new Error('This method is abstract');
  };

};
Workflow.prototype = new Workflow.Prototype();

module.exports = Workflow;

},{}],171:[function(require,module,exports){
"use strict";

var View = require("./view");
var Router = require("./router");
var util = require("../../substance/util");
var _ = require("underscore");

// Substance.Application
// ==========================================================================
//
// Application abstraction suggesting strict MVC

var Application = function(config) {
  View.call(this);
  this.config = config;
};

Application.Prototype = function() {
  
  // Init router
  // ----------

  this.initRouter = function() {
    this.router = new Router();

    _.each(this.config.routes, function(route) {
      this.router.route(route.route, route.name, _.bind(this.controller[route.command], this.controller));
    }, this);

    Router.history.start();
  };

  // Start Application
  // ----------
  //

  this.start = function() {
    // First setup the top level view
    this.$el = $('body');
    this.el = this.$el[0];
    this.render();

    // Now the normal app lifecycle can begin
    // Because app state changes require the main view to be present
    // Triggers an initial app state change according to url hash fragment
    this.initRouter();
  };
};

// Setup prototype chain

Application.Prototype.prototype = View.prototype;
Application.prototype = new Application.Prototype();

module.exports = Application;

},{"../../substance/util":195,"./router":175,"./view":176,"underscore":198}],172:[function(require,module,exports){
"use strict";

var util = require("../../substance/util");
var _ = require("underscore");

// Substance.Application.Controller
// ==========================================================================
//
// Application Controller abstraction suggesting strict MVC

var Controller = function(options) {
  this.state = {};
  this.context = null;
};

Controller.Prototype = function() {

  // Finalize state transition
  // -----------------
  //
  // Editor View listens on state-changed events:
  //
  // Maybe this should updateContext, so it can't be confused with the app state
  // which might be more than just the current context
  // 

  this.updateState = function(context, state) {
    console.error('updateState is deprecated, use modifyState. State is now a rich object where context replaces the old state variable');
    var oldContext = this.context;
    this.context = context;
    this.state = state;
    this.trigger('state-changed', this.context, oldContext, state);
  };

  // Inrementally updates the controller state
  // -----------------
  //

  this.modifyState = function(state) {
    var prevContext = this.state.context;
    _.extend(this.state, state);

    if (state.context && state.context !== prevContext) {
      this.trigger('context-changed', state.context);
    }
    
    this.trigger('state-changed', this.state.context);
  };
};


// Setup prototype chain
Controller.Prototype.prototype = util.Events;
Controller.prototype = new Controller.Prototype();

module.exports = Controller;
},{"../../substance/util":195,"underscore":198}],173:[function(require,module,exports){
"use strict";

var Application = require("./application");
Application.View = require("./view");
Application.Router = require("./router");
Application.Controller = require("./controller");
Application.ElementRenderer = require("./renderers/element_renderer");
Application.$$ = Application.ElementRenderer.$$;

module.exports = Application;

},{"./application":171,"./controller":172,"./renderers/element_renderer":174,"./router":175,"./view":176}],174:[function(require,module,exports){
"use strict";

var util = require("../../../substance/util");

var SRegExp = util.RegExp;

// Substance.Application.ElementRenderer
// ==========================================================================
//
// This is just a simple helper that allows us to create DOM elements
// in a data-driven way

var ElementRenderer = function(attributes) {
  this.attributes = attributes;

  // Pull off preserved properties from attributes
  // --------

  this.tagName = attributes.tag;
  this.children = attributes.children || [];
  this.text = attributes.text || "";
  this.html = attributes.html;

  delete attributes.children;
  delete attributes.text;
  delete attributes.html;
  delete attributes.tag;

  return this.render();
};


ElementRenderer.Prototype = function() {

  // Do the actual rendering
  // --------

  this.render = function() {
    var el = document.createElement(this.tagName);
    if (this.html) {
      el.innerHTML = this.html;
    } else {
      el.textContent = this.text;
    }

    // Set attributes based on element spec
    for(var attrName in this.attributes) {
      var val = this.attributes[attrName];
      el.setAttribute(attrName, val);
    }

    // Append childs
    for (var i=0; i<this.children.length; i++) {
      var child = this.children[i];
      el.appendChild(child);
    }

    // Remember element
    // Probably we should ditch this
    this.el = el;
    return el;
  };
};


// Provides a shortcut syntax interface to ElementRenderer
// --------

var $$ = function(descriptor, options) {
  var options = options  || {};

  // Extract tagName, defaults to 'div'
  var tagName = /^([a-zA-Z0-9]*)/.exec(descriptor);
  options.tag = tagName && tagName[1] ? tagName[1] : 'div';

  // Any occurence of #some_chars
  var id = /#([a-zA-Z0-9_]*)/.exec(descriptor);
  if (id && id[1]) options.id = id[1];

  // Any occurence of .some-chars
  // if (!options.class) {
  //   var re = new RegExp(/\.([a-zA-Z0-9_-]*)/g);
  //   var classes = [];
  //   var classMatch;
  //   while (classMatch = re.exec(descriptor)) {
  //     classes.push(classMatch[1]);
  //   }
  //   options.class = classes.join(' ');
  // }

  // Any occurence of .some-chars
  var matchClasses = new SRegExp(/\.([a-zA-Z0-9_-]*)/g);
  // options.class = options.class ? options.class+' ' : '';
  if (!options.class) {
    options.class = matchClasses.match(descriptor).map(function(m) {
      return m.match[1];
    }).join(' ');
  }

  return new ElementRenderer(options);
};



ElementRenderer.$$ = $$;

// Setup prototype chain
ElementRenderer.Prototype.prototype = util.Events;
ElementRenderer.prototype = new ElementRenderer.Prototype();

module.exports = ElementRenderer;
},{"../../../substance/util":195}],175:[function(require,module,exports){
"use strict";

var util = require("../../substance/util");
var _ = require("underscore");

// Application.Router
// ---------------
//
// Implementation borrowed from Backbone.js

// Routers map faux-URLs to actions, and fire events when routes are
// matched. Creating a new one sets its `routes` hash, if not set statically.
var Router = function(options) {
  options || (options = {});
  if (options.routes) this.routes = options.routes;
  this._bindRoutes();
  this.initialize.apply(this, arguments);
};

// Cached regular expressions for matching named param parts and splatted
// parts of route strings.
var optionalParam = /\((.*?)\)/g;
var namedParam    = /(\(\?)?:\w+/g;
var splatParam    = /\*\w+/g;
var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

// Set up all inheritable **Application.Router** properties and methods.
_.extend(Router.prototype, util.Events, {

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // Manually bind a single named route to a callback. For example:
  //
  //     this.route('search/:query/p:num', 'search', function(query, num) {
  //       ...
  //     });
  //
  route: function(route, name, callback) {
    if (!_.isRegExp(route)) route = this._routeToRegExp(route);
    if (_.isFunction(name)) {
      callback = name;
      name = '';
    }
    if (!callback) callback = this[name];
    var router = this;
    Router.history.route(route, function(fragment) {
      var args = router._extractParameters(route, fragment);
      callback && callback.apply(router, args);
      router.trigger.apply(router, ['route:' + name].concat(args));
      router.trigger('route', name, args);
      Router.history.trigger('route', router, name, args);
    });
    return this;
  },

  // Simple proxy to `Router.history` to save a fragment into the history.
  navigate: function(fragment, options) {
    Router.history.navigate(fragment, options);
    return this;
  },

  // Bind all defined routes to `Router.history`. We have to reverse the
  // order of the routes here to support behavior where the most general
  // routes can be defined at the bottom of the route map.
  _bindRoutes: function() {
    if (!this.routes) return;
    this.routes = _.result(this, 'routes');
    var route, routes = _.keys(this.routes);
    while ((route = routes.pop()) != null) {
      this.route(route, this.routes[route]);
    }
  },

  // Convert a route string into a regular expression, suitable for matching
  // against the current location hash.
  _routeToRegExp: function(route) {
    route = route.replace(escapeRegExp, '\\$&')
                 .replace(optionalParam, '(?:$1)?')
                 .replace(namedParam, function(match, optional){
                   return optional ? match : '([^\/]+)';
                 })
                 .replace(splatParam, '(.*?)');
    return new RegExp('^' + route + '$');
  },

  // Given a route, and a URL fragment that it matches, return the array of
  // extracted decoded parameters. Empty or unmatched parameters will be
  // treated as `null` to normalize cross-browser behavior.
  _extractParameters: function(route, fragment) {
    var params = route.exec(fragment).slice(1);
    return _.map(params, function(param) {
      return param ? decodeURIComponent(param) : null;
    });
  }
});




// Router.History
// ----------------

// Handles cross-browser history management, based on either
// [pushState](http://diveintohtml5.info/history.html) and real URLs, or
// [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
// and URL fragments. If the browser supports neither (old IE, natch),
// falls back to polling.
var History = Router.History = function() {
  this.handlers = [];
  _.bindAll(this, 'checkUrl');

  // Ensure that `History` can be used outside of the browser.
  if (typeof window !== 'undefined') {
    this.location = window.location;
    this.history = window.history;
  }
};

// Cached regex for stripping a leading hash/slash and trailing space.
var routeStripper = /^[#\/]|\s+$/g;

// Cached regex for stripping leading and trailing slashes.
var rootStripper = /^\/+|\/+$/g;

// Cached regex for detecting MSIE.
var isExplorer = /msie [\w.]+/;

// Cached regex for removing a trailing slash.
var trailingSlash = /\/$/;

// Has the history handling already been started?
History.started = false;

// Set up all inheritable **Router.History** properties and methods.
_.extend(History.prototype, util.Events, {

  // The default interval to poll for hash changes, if necessary, is
  // twenty times a second.
  interval: 50,

  // Gets the true hash value. Cannot use location.hash directly due to bug
  // in Firefox where location.hash will always be decoded.
  getHash: function(window) {
    var match = (window || this).location.href.match(/#(.*)$/);
    return match ? match[1] : '';
  },

  // Get the cross-browser normalized URL fragment, either from the URL,
  // the hash, or the override.
  getFragment: function(fragment, forcePushState) {
    if (fragment == null) {
      if (this._hasPushState || !this._wantsHashChange || forcePushState) {
        fragment = this.location.pathname;
        var root = this.root.replace(trailingSlash, '');
        if (!fragment.indexOf(root)) fragment = fragment.substr(root.length);
      } else {
        fragment = this.getHash();
      }
    }
    return fragment.replace(routeStripper, '');
  },

  // Start the hash change handling, returning `true` if the current URL matches
  // an existing route, and `false` otherwise.
  start: function(options) {
    if (History.started) throw new Error("Router.history has already been started");
    History.started = true;

    // Figure out the initial configuration. Do we need an iframe?
    // Is pushState desired ... is it available?
    this.options          = _.extend({}, {root: '/'}, this.options, options);
    this.root             = this.options.root;
    this._wantsHashChange = this.options.hashChange !== false;
    this._wantsPushState  = !!this.options.pushState;
    this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
    var fragment          = this.getFragment();
    var docMode           = document.documentMode;
    var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

    // Normalize root to always include a leading and trailing slash.
    this.root = ('/' + this.root + '/').replace(rootStripper, '/');

    if (oldIE && this._wantsHashChange) {
      this.iframe = $('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
      this.navigate(fragment);
    }

    // Depending on whether we're using pushState or hashes, and whether
    // 'onhashchange' is supported, determine how we check the URL state.
    if (this._hasPushState) {
      $(window).on('popstate', this.checkUrl);
    } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
      $(window).on('hashchange', this.checkUrl);
    } else if (this._wantsHashChange) {
      this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
    }

    // Determine if we need to change the base url, for a pushState link
    // opened by a non-pushState browser.
    this.fragment = fragment;
    var loc = this.location;
    var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;

    // If we've started off with a route from a `pushState`-enabled browser,
    // but we're currently in a browser that doesn't support it...
    if (this._wantsHashChange && this._wantsPushState && !this._hasPushState && !atRoot) {
      this.fragment = this.getFragment(null, true);
      this.location.replace(this.root + this.location.search + '#' + this.fragment);
      // Return immediately as browser will do redirect to new url
      return true;

    // Or if we've started out with a hash-based route, but we're currently
    // in a browser where it could be `pushState`-based instead...
    } else if (this._wantsPushState && this._hasPushState && atRoot && loc.hash) {
      this.fragment = this.getHash().replace(routeStripper, '');
      this.history.replaceState({}, document.title, this.root + this.fragment + loc.search);
    }

    if (!this.options.silent) return this.loadUrl();
  },

  // Disable Router.history, perhaps temporarily. Not useful in a real app,
  // but possibly useful for unit testing Routers.
  stop: function() {
    $(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
    clearInterval(this._checkUrlInterval);
    History.started = false;
  },

  // Add a route to be tested when the fragment changes. Routes added later
  // may override previous routes.
  route: function(route, callback) {
    this.handlers.unshift({route: route, callback: callback});
  },

  // Checks the current URL to see if it has changed, and if it has,
  // calls `loadUrl`, normalizing across the hidden iframe.
  checkUrl: function(e) {
    var current = this.getFragment();
    if (current === this.fragment && this.iframe) {
      current = this.getFragment(this.getHash(this.iframe));
    }
    if (current === this.fragment) return false;
    if (this.iframe) this.navigate(current);
    this.loadUrl() || this.loadUrl(this.getHash());
  },

  // Attempt to load the current URL fragment. If a route succeeds with a
  // match, returns `true`. If no defined routes matches the fragment,
  // returns `false`.
  loadUrl: function(fragmentOverride) {
    var fragment = this.fragment = this.getFragment(fragmentOverride);
    var matched = _.any(this.handlers, function(handler) {
      if (handler.route.test(fragment)) {
        handler.callback(fragment);
        return true;
      }
    });
    return matched;
  },

  // Save a fragment into the hash history, or replace the URL state if the
  // 'replace' option is passed. You are responsible for properly URL-encoding
  // the fragment in advance.
  //
  // The options object can contain `trigger: true` if you wish to have the
  // route callback be fired (not usually desirable), or `replace: true`, if
  // you wish to modify the current URL without adding an entry to the history.
  navigate: function(fragment, options) {
    if (!History.started) return false;
    if (!options || options === true) options = {trigger: options};
    fragment = this.getFragment(fragment || '');
    if (this.fragment === fragment) return;
    this.fragment = fragment;
    var url = this.root + fragment;

    // If pushState is available, we use it to set the fragment as a real URL.
    if (this._hasPushState) {
      this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

    // If hash changes haven't been explicitly disabled, update the hash
    // fragment to store history.
    } else if (this._wantsHashChange) {
      this._updateHash(this.location, fragment, options.replace);
      if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
        // Opening and closing the iframe tricks IE7 and earlier to push a
        // history entry on hash-tag change.  When replace is true, we don't
        // want this.
        if(!options.replace) this.iframe.document.open().close();
        this._updateHash(this.iframe.location, fragment, options.replace);
      }

    // If you've told us that you explicitly don't want fallback hashchange-
    // based history, then `navigate` becomes a page refresh.
    } else {
      return this.location.assign(url);
    }
    if (options.trigger) this.loadUrl(fragment);
  },

  // Update the hash location, either replacing the current entry, or adding
  // a new one to the browser history.
  _updateHash: function(location, fragment, replace) {
    if (replace) {
      var href = location.href.replace(/(javascript:|#).*$/, '');
      location.replace(href + '#' + fragment);
    } else {
      // Some browsers require that `hash` contains a leading #.
      location.hash = '#' + fragment;
    }
  }
});

Router.history = new History;


module.exports = Router;
},{"../../substance/util":195,"underscore":198}],176:[function(require,module,exports){
"use strict";

var util = require("../../substance/util");

// Substance.View
// ==========================================================================
//
// Application View abstraction, inspired by Backbone.js

var View = function(options) {
  options = options || {};
  var that = this;
  // Either use the provided element or make up a new element
  this.el = options.el || window.document.createElement(options.elementType || 'div');
  this.$el = $(this.el);

  this.dispatchDOMEvents();
};


View.Prototype = function() {


  // Shorthand for selecting elements within the view
  // ----------
  //

  this.$ = function(selector) {
    return this.$el.find(selector);
  };

  this.render = function() {
    return this;
  };

  // Dispatching DOM events (like clicks)
  // ----------
  //

  this.dispatchDOMEvents = function() {

    var that = this;

    // showReport(foo) => ["showReport(foo)", "showReport", "foo"]
    // showReport(12) => ["showReport(12)", "showReport", "12"]
    function extractFunctionCall(str) {
      var match = /(\w+)\((.*)\)/.exec(str);
      if (!match) throw new Error("Invalid click handler '"+str+"'");

      return {
        "method": match[1],
        "args": match[2].split(',')
      };
    }

    this.$el.delegate('[sbs-click]', 'click', function(e) {
      console.error("FIXME: sbs-click is deprecated. Use jquery handlers with selectors instead.");

      // Matches things like this
      // showReport(foo) => ["showReport(foo)", "showReport", "foo"]
      // showReport(12) => ["showReport(12)", "showReport", "12"]
      var fnCall = extractFunctionCall($(e.currentTarget).attr('sbs-click'));

      // Event bubbles up if there is no handler
      var method = that[fnCall.method];
      if (method) {
        e.stopPropagation();
        e.preventDefault();
        method.apply(that, fnCall.args);
        return false;
      }
    });
  };
};


View.Prototype.prototype = util.Events;
View.prototype = new View.Prototype();

module.exports = View;

},{"../../substance/util":195}],177:[function(require,module,exports){
"use strict";

var _ = require('underscore');
var util = require("../../substance/util");
var errors = util.errors;

var Schema = require('./schema');
var Property = require('./property');
var Index = require('./graph_index');

var GraphError = errors.define("GraphError");

// Data types registry
// -------------------
// Available data types for graph properties.

var VALUE_TYPES = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'date'
];


// Check if composite type is in types registry.
// The actual type of a composite type is the first entry
// I.e., ["array", "string"] is an array in first place.
var isValueType = function (type) {
  if (_.isArray(type)) {
    type = type[0];
  }
  return VALUE_TYPES.indexOf(type) >= 0;
};

// Graph
// =====

// A `Graph` can be used for representing arbitrary complex object
// graphs. Relations between objects are expressed through links that
// point to referred objects. Graphs can be traversed in various ways.
// See the testsuite for usage.
//
// Need to be documented:
// @options (mode,seed,chronicle,store,load,graph)
var Graph = function(schema, options) {
  options = options || {};

  // Initialization
  this.schema = new Schema(schema);

  // Check if provided seed conforms to the given schema
  // Only when schema has an id and seed is provided

  if (this.schema.id && options.seed && options.seed.schema) {
    if (!_.isEqual(options.seed.schema, [this.schema.id, this.schema.version])) {
      throw new GraphError([
        "Graph does not conform to schema. Expected: ",
        this.schema.id+"@"+this.schema.version,
        " Actual: ",
        options.seed.schema[0]+"@"+options.seed.schema[1]
      ].join(''));
    }
  }

  this.nodes = {};
  this.indexes = {};

  this.__seed__ = options.seed;

  this.init();
};

Graph.Prototype = function() {

  // Graph manipulation API
  // ======================

  // Add a new node
  // --------------
  // Adds a new node to the graph
  // Only properties that are specified in the schema are taken:
  //     var node = {
  //       id: "apple",
  //       type: "fruit",
  //       name: "My Apple",
  //       color: "red",
  //       val: { size: "big" }
  //     };
  // Create new node:
  //     Data.Graph.create(node);
  // Note: graph create operation should reject creation of duplicate nodes.

  _.extend(this, util.Events);

  this.create = function(node) {
    this.nodes[node.id] = node;
    this._updateIndexes({
      type: 'create',
      path: [node.id],
      val: node
    });
  };

  // Remove a node
  // -------------
  // Removes a node with given id and key (optional):
  //     Data.Graph.delete(this.graph.get('apple'));
  this.delete = function(id) {
    var oldVal = this.nodes[id];
    delete this.nodes[id];
    this._updateIndexes({
      type: 'delete',
      path: [id],
      val: oldVal
    });
  };

  // Set the property
  // ----------------
  //
  // Sets the property to a given value:
  // Data.Graph.set(["fruit_2", "val", "size"], "too small");
  // Let's see what happened with node:
  //     var blueberry = this.graph.get("fruit_2");
  //     console.log(blueberry.val.size);
  //     = > 'too small'

  this.set = function(path, newValue) {
    var prop = this.resolve(path);
    if (!prop) {
      throw new GraphError("Could not resolve property with path "+JSON.stringify(path));
    }
    var oldVal = prop.get();
    prop.set(newValue);
    this._updateIndexes({
      type: 'set',
      path: path,
      val: newValue,
      original: oldVal
    });
  };

  // Get the node [property]
  // -----------------------
  //
  // Gets specified graph node using id:
  //  var apple = this.graph.get("apple");
  //  console.log(apple);
  //  =>
  //  {
  //    id: "apple",
  //    type: "fruit",
  //    name: "My Apple",
  //    color: "red",
  //    val: { size: "big" }
  //  }
  // or get node's property:
  //  var apple = this.graph.get(["apple","color"]);
  //  console.log(apple);
  //  => 'red'

  this.get = function(path) {
    if (!_.isArray(path) && !_.isString(path)) {
      throw new GraphError("Invalid argument path. Must be String or Array");
    }

    if (arguments.length > 1) path = _.toArray(arguments);
    if (_.isString(path)) return this.nodes[path];

    var prop = this.resolve(path);
    return prop.get();
  };

  // Query graph data
  // ----------------
  //
  // Perform smart querying on graph
  //     graph.create({
  //       id: "apple-tree",
  //       type: "tree",
  //       name: "Apple tree"
  //     });
  //     var apple = this.graph.get("apple");
  //     apple.set({["apple","tree"], "apple-tree"});
  // let's perform query:
  //     var result = graph.query(["apple", "tree"]);
  //     console.log(result);
  //     => [{id: "apple-tree", type: "tree", name: "Apple tree"}]

  this.query = function(path) {
    var prop = this.resolve(path);

    var type = prop.type;
    var baseType = prop.baseType;
    var val = prop.get();

    // resolve referenced nodes in array types
    if (baseType === "array") {
      return this._queryArray.call(this, val, type);
    } else if (!isValueType(baseType)) {
      return this.get(val);
    } else {
      return val;
    }
  };

  // Serialize current state
  // -----------------------
  //
  // Convert current graph state to JSON object

  this.toJSON = function() {
    return {
      id: this.id,
      schema: [this.schema.id, this.schema.version],
      nodes: util.deepclone(this.nodes)
    };
  };

  // Check node existing
  // -------------------
  //
  // Checks if a node with given id exists
  //     this.graph.contains("apple");
  //     => true
  //     this.graph.contains("orange");
  //     => false

  this.contains = function(id) {
    return (!!this.nodes[id]);
  };

  // Resolve a property
  // ------------------
  // Resolves a property with a given path

  this.resolve = function(path) {
    return new Property(this, path);
  };

  // Reset to initial state
  // ----------------------
  // Resets the graph to its initial state.
  // Note: This clears all nodes and calls `init()` which may seed the graph.

  this.reset = function() {
    this.init();
    this.trigger("graph:reset");
  };

  // Graph initialization.
  this.init = function() {
    this.__is_initializing__ = true;

    if (this.__seed__) {
      this.nodes = util.clone(this.__seed__.nodes);
    } else {
      this.nodes = {};
    }

    _.each(this.indexes, function(index) {
      index.reset();
    });

    delete this.__is_initializing__;
  };

  this.addIndex = function(name, options) {
    if (this.indexes[name]) {
      throw new GraphError("Index with name " + name + "already exists.");
    }
    var index = new Index(this, options);
    this.indexes[name] = index;

    return index;
  };

  this.removeIndex = function(name) {
    delete this.indexes[name];
  };

  this._updateIndexes = function(op) {
    _.each(this.indexes, function(index) {
      if (!op) {
        index.rebuild();
      } else {
        index.onGraphChange(op);
      }
    }, this);
  };

  this._queryArray = function(arr, type) {
    if (!_.isArray(type)) {
      throw new GraphError("Illegal argument: array types must be specified as ['array'(, 'array')*, <type>]");
    }
    var result, idx;
    if (type[1] === "array") {
      result = [];
      for (idx = 0; idx < arr.length; idx++) {
        result.push(this._queryArray(arr[idx], type.slice(1)));
      }
    } else if (!isValueType(type[1])) {
      result = [];
      for (idx = 0; idx < arr.length; idx++) {
        result.push(this.get(arr[idx]));
      }
    } else {
      result = arr;
    }
    return result;
  };

};

// Index Modes
// ----------

Graph.STRICT_INDEXING = 1 << 1;
Graph.DEFAULT_MODE = Graph.STRICT_INDEXING;


Graph.prototype = new Graph.Prototype();

Graph.Schema = Schema;
Graph.Property = Property;
Graph.Index = Index;

// Exports
// ========

module.exports = Graph;

},{"../../substance/util":195,"./graph_index":178,"./property":180,"./schema":181,"underscore":198}],178:[function(require,module,exports){
var _ = require("underscore");
var util = require("../../substance/util");

// Creates an index for the document applying a given node filter function
// and grouping using a given key function
// --------
//
// - document: a document instance
// - filter: a function that takes a node and returns true if the node should be indexed
// - key: a function that provides a path for scoped indexing (default: returns empty path)
//

var Index = function(graph, options) {
  options = options || {};

  this.graph = graph;

  this.nodes = {};
  this.scopes = {};

  if (options.filter) {
    this.filter = options.filter;
  } else if (options.types) {
    this.filter = Index.typeFilter(graph.schema, options.types);
  }

  if (options.property) {
    this.property = options.property;
  }

  this.createIndex();
};

Index.Prototype = function() {

  // Resolves a sub-hierarchy of the index via a given path
  // --------
  //

  var _resolve = function(path) {
    var index = this;
    if (path !== null) {
      for (var i = 0; i < path.length; i++) {
        var id = path[i];
        index.scopes[id] = index.scopes[id] || { nodes: {}, scopes: {} };
        index = index.scopes[id];
      }
    }
    return index;
  };

  var _getKey = function(node) {
    if (!this.property) return null;
    var key = node[this.property] ? node[this.property] : null;
    if (_.isString(key)) key = [key];
    return key;
  };

  // Accumulates all indexed children of the given (sub-)index
  var _collect = function(index) {
    var result = _.extend({}, index.nodes);
    _.each(index.scopes, function(child, name) {
      if (name !== "nodes") {
        _.extend(result, _collect(child));
      }
    });
    return result;
  };

  // Keeps the index up-to-date when the graph changes.
  // --------
  //

  this.onGraphChange = function(op) {
    this.applyOp(op);
  };

  this._add = function(node) {
    if (!this.filter || this.filter(node)) {
      var key = _getKey.call(this, node);
      var index = _resolve.call(this, key);
      index.nodes[node.id] = node.id;
    }
  };

  this._remove = function(node) {
    if (!this.filter || this.filter(node)) {
      var key = _getKey.call(this, node);
      var index = _resolve.call(this, key);
      delete index.nodes[node.id];
    }
  };

  this._update = function(node, property, newValue, oldValue) {
    if ((this.property === property) && (!this.filter || this.filter(node))) {
      var key = oldValue;
      if (_.isString(key)) key = [key];
      var index = _resolve.call(this, key);
      delete index.nodes[node.id];
      key = newValue;
      index.nodes[node.id] = node.id;
    }
  };


  this.applyOp = function(op) {
    if (op.type === "create") {
      this._add(op.val);
    }
    else if (op.type === "delete") {
      this._remove(op.val);
    }
    // type = 'update' or 'set'
    else {
      var prop = this.graph.resolve(this, op.path);
      var value = prop.get();
      var oldValue;
      if (value === undefined) {
        return;
      }
      if (op.type === "set") {
        oldValue = op.original;
      } else {
        console.error("Operational updates are not supported in this implementation");
      }
      this._update(prop.node, prop.key, value, oldValue);
    }
  };

  // Initializes the index
  // --------
  //

  this.createIndex = function() {
    this.reset();

    var nodes = this.graph.nodes;
    _.each(nodes, function(node) {
      if (!this.filter || this.filter(node)) {
        var key = _getKey.call(this, node);
        var index = _resolve.call(this, key);
        index.nodes[node.id] = node.id;
      }
    }, this);
  };

  // Collects all indexed nodes using a given path for scoping
  // --------
  //

  this.get = function(path) {
    if (arguments.length === 0) {
      path = null;
    } else if (_.isString(path)) {
      path = [path];
    }

    var index = _resolve.call(this, path);

    // EXPERIMENTAL: do we need the ability to retrieve indexed elements non-recursively
    // for now...
    // if so... we would need an paramater to prevent recursion
    // E.g.:
    //     if (shallow) {
    //       result = index.nodes;
    //     }
    var collected = _collect(index);
    var result = new Index.Result();

    _.each(collected, function(id) {
      result[id] = this.graph.get(id);
    }, this);

    return result;
  };

  this.reset = function() {
    this.nodes = {};
    this.scopes = {};
  };

  this.dispose = function() {
    this.stopListening();
  };

  this.rebuild = function() {
    this.reset();
    this.createIndex();
  };
};

Index.prototype = _.extend(new Index.Prototype(), util.Events.Listener);

Index.typeFilter = function(schema, types) {
  return function(node) {
    var typeChain = schema.typeChain(node.type);
    for (var i = 0; i < types.length; i++) {
      if (typeChain.indexOf(types[i]) >= 0) {
        return true;
      }
    }
    return false;
  };
};

Index.Result = function() {};
Index.Result.prototype.asList = function() {
  var list = [];
  for (var key in this) {
    list.push(this[key]);
  }
};
Index.Result.prototype.getLength = function() {
  return Object.keys(this).length;
};

module.exports = Index;

},{"../../substance/util":195,"underscore":198}],179:[function(require,module,exports){
"use strict";

var Data = {};

// Current version of the library. Keep in sync with `package.json`.
Data.VERSION = '0.8.0';

Data.Graph = require('./graph');

module.exports = Data;

},{"./graph":177}],180:[function(require,module,exports){
"use strict";

var _ = require("underscore");

var Property = function(graph, path) {
  if (!path) {
    throw new Error("Illegal argument: path is null/undefined.");
  }

  this.graph = graph;
  this.schema = graph.schema;

  _.extend(this, this.resolve(path));
};

Property.Prototype = function() {

  this.resolve = function(path) {
    var node = this.graph;
    var parent = node;
    var type = "graph";

    var key;
    var value;

    var idx = 0;
    for (; idx < path.length; idx++) {

      // TODO: check if the property references a node type
      if (type === "graph" || this.schema.types[type] !== undefined) {
        // remember the last node type
        parent = this.graph.get(path[idx]);

        if (parent === undefined) {
          //throw new Error("Key error: could not find element for path " + JSON.stringify(path));
          return undefined;
        }

        node = parent;
        type = this.schema.properties(parent.type);
        value = node;
        key = undefined;
      } else {
        if (parent === undefined) {
          //throw new Error("Key error: could not find element for path " + JSON.stringify(path));
          return undefined;
        }
        key = path[idx];
        var propName = path[idx];
        type = type[propName];
        value = parent[key];

        if (idx < path.length-1) {
          parent = parent[propName];
        }
      }
    }

    return {
      node: node,
      parent: parent,
      type: type,
      key: key,
      value: value
    };

  };

  this.get = function() {
    if (this.key !== undefined) {
      return this.parent[this.key];
    } else {
      return this.node;
    }
  };

  this.set = function(value) {
    if (this.key !== undefined) {
      this.parent[this.key] = this.schema.parseValue(this.baseType, value);
    } else {
      throw new Error("'set' is only supported for node properties.");
    }
  };

};
Property.prototype = new Property.Prototype();
Object.defineProperties(Property.prototype, {
  baseType: {
    get: function() {
      if (_.isArray(this.type)) return this.type[0];
      else return this.type;
    }
  },
  path: {
    get: function() {
      return [this.node.id, this.key];
    }
  }
});

module.exports = Property;

},{"underscore":198}],181:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var util = require("../../substance/util");


// Data.Schema
// ========
//
// Provides a schema inspection API

var Schema = function(schema) {
  _.extend(this, schema);
};

Schema.Prototype = function() {

  // Return Default value for a given type
  // --------
  //

  this.defaultValue = function(valueType) {
    if (valueType === "object") return {};
    if (valueType === "array") return [];
    if (valueType === "string") return "";
    if (valueType === "number") return 0;
    if (valueType === "boolean") return false;
    if (valueType === "date") return new Date();

    return null;
    // throw new Error("Unknown value type: " + valueType);
  };

  // Return type object for a given type id
  // --------
  //

  this.parseValue = function(valueType, value) {
    if (value === null) {
      return value;
    }

    if (_.isString(value)) {
      if (valueType === "object") return JSON.parse(value);
      if (valueType === "array") return JSON.parse(value);
      if (valueType === "string") return value;
      if (valueType === "number") return parseInt(value, 10);
      if (valueType === "boolean") {
        if (value === "true") return true;
        else if (value === "false") return false;
        else throw new Error("Can not parse boolean value from: " + value);
      }
      if (valueType === "date") return new Date(value);

      // all other types must be string compatible ??
      return value;

    } else {
      if (valueType === 'array') {
        if (!_.isArray(value)) {
          throw new Error("Illegal value type: expected array.");
        }
        value = util.deepclone(value);
      }
      else if (valueType === 'string') {
        if (!_.isString(value)) {
          throw new Error("Illegal value type: expected string.");
        }
      }
      else if (valueType === 'object') {
        if (!_.isObject(value)) {
          throw new Error("Illegal value type: expected object.");
        }
        value = util.deepclone(value);
      }
      else if (valueType === 'number') {
        if (!_.isNumber(value)) {
          throw new Error("Illegal value type: expected number.");
        }
      }
      else if (valueType === 'boolean') {
        if (!_.isBoolean(value)) {
          throw new Error("Illegal value type: expected boolean.");
        }
      }
      else if (valueType === 'date') {
        value = new Date(value);
      }
      else {
        throw new Error("Unsupported value type: " + valueType);
      }
      return value;
    }
  };

  // Return type object for a given type id
  // --------
  //

  this.type = function(typeId) {
    return this.types[typeId];
  };

  // For a given type id return the type hierarchy
  // --------
  //
  // => ["base_type", "specific_type"]

  this.typeChain = function(typeId) {
    var type = this.types[typeId];
    if (!type) {
      throw new Error('Type ' + typeId + ' not found in schema');
    }

    var chain = (type.parent) ? this.typeChain(type.parent) : [];
    chain.push(typeId);
    return chain;
  };

  this.isInstanceOf = function(type, parentType) {
    var typeChain = this.typeChain(type);
    if (typeChain && typeChain.indexOf(parentType) >= 0) {
      return true;
    } else {
      return false;
    }
  };

  // Provides the top-most parent type of a given type.
  // --------
  //

  this.baseType = function(typeId) {
    return this.typeChain(typeId)[0];
  };

  // Return all properties for a given type
  // --------
  //

  this.properties = function(type) {
    type = _.isObject(type) ? type : this.type(type);
    var result = (type.parent) ? this.properties(type.parent) : {};
    _.extend(result, type.properties);
    return result;
  };

  // Returns the full type for a given property
  // --------
  //
  // => ["array", "string"]

  this.propertyType = function(type, property) {
    var properties = this.properties(type);
    var propertyType = properties[property];
    if (!propertyType) throw new Error("Property not found for" + type +'.'+property);
    return _.isArray(propertyType) ? propertyType : [propertyType];
  };

  // Returns the base type for a given property
  // --------
  //
  //  ["string"] => "string"
  //  ["array", "string"] => "array"

  this.propertyBaseType = function(type, property) {
    return this.propertyType(type, property)[0];
  };
};

Schema.prototype = new Schema.Prototype();

module.exports = Schema;

},{"../../substance/util":195,"underscore":198}],182:[function(require,module,exports){
var DocumentNode = require("./node");

var Composite = function(node, doc) {
  DocumentNode.call(this, node, doc);
};

// Type definition
// -----------------
//

Composite.type = {
  "id": "composite",
  "parent": "content",
  "properties": {
  }
};


// This is used for the auto-generated docs
// -----------------
//

Composite.description = {
  "name": "Composite",
  "remarks": [
    "A file reference to an external resource.",
  ],
  "properties": {
  }
};

// Example File
// -----------------
//

Composite.example = {
  "no_example": "yet"
};

Composite.Prototype = function() {

  this.getLength = function() {
    throw new Error("Composite.getLength() is abstract.");
  };

  // Provides the ids of all referenced sub-nodes.
  // -------
  //

  // Only for legacy reasons
  this.getNodes = function() {
    return this.getChildrenIds();
  };

  this.getChildrenIds = function() {
    throw new Error("Composite.getChildrenIds() is abstract.");
  };

  // Tells if this composite is can be changed with respect to its children
  // --------
  //

  this.isMutable = function() {
    return false;
  };

  this.insertOperation = function(/*charPos, text*/) {
    return null;
  };

  this.deleteOperation = function(/*startChar, endChar*/) {
    return null;
  };

  // Inserts reference(s) at the given position
  // --------
  //

  this.insertChild = function(/*doc, pos, nodeId*/) {
    throw new Error("This composite is immutable.");
  };

  // Removes a reference from this composite.
  // --------

  this.deleteChild = function(/*doc, nodeId*/) {
    throw new Error("This composite is immutable.");
  };

  // Provides the index of the affected node.
  // --------
  //

  this.getChangePosition = function(op) {
    return 0;
  };

};

Composite.Prototype.prototype = DocumentNode.prototype;
Composite.prototype = new Composite.Prototype();

module.exports = Composite;

},{"./node":187}],183:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var util = require("../../substance/util");
var Composite = require("./composite");

var Container = function(document, view) {
  this.document = document;
  this.view = view;

  this.treeView = [];
  this.listView = [];

  this.__parents = {};
  this.__composites = {};

  this.rebuild();
};

Container.Prototype = function() {

  var _each = function(iterator, context) {
    var queue = [];
    var i;

    for (i = this.treeView.length - 1; i >= 0; i--) {
      queue.unshift({
        id: this.treeView[i],
        parent: null
      });
    }

    var item, node;
    while(queue.length > 0) {
      item = queue.shift();
      node = this.document.get(item.id);
      if (node instanceof Composite) {
        var children = node.getNodes();
        for (i = children.length - 1; i >= 0; i--) {
          queue.unshift({
            id: children[i],
            parent: node.id,
          });
        }
      }
      iterator.call(context, node, item.parent);
    }
  };

  this.rebuild = function() {

    // clear the list view
    this.treeView.splice(0, this.treeView.length);
    this.listView.splice(0, this.listView.length);

    this.treeView = _.clone(this.view.nodes);
    for (var i = 0; i < this.view.length; i++) {
      this.treeView.push(this.view[i]);
    }

    this.__parents = {};
    this.__composites = {};
    _each.call(this, function(node, parent) {
      if (node instanceof Composite) {
        this.__parents[node.id] = parent;
        this.__composites[parent] = parent;
      } else {
        this.listView.push(node.id);
        if (this.__parents[node.id]) {
          throw new Error("Nodes must be unique in one view.");
        }
        this.__parents[node.id] = parent;
        this.__composites[parent] = parent;
      }
    }, this);
  };

  this.getTopLevelNodes = function() {
    return _.map(this.treeView, function(id) {
      return this.document.get(id);
    }, this);
  };

  this.getNodes = function(idsOnly) {
    var nodeIds = this.listView;
    if (idsOnly) {
      return _.clone(nodeIds);
    }
    else {
      var result = [];
      for (var i = 0; i < nodeIds.length; i++) {
        result.push(this.document.get(nodeIds[i]));
      }
      return result;
    }
  };

  this.getPosition = function(nodeId) {
    var nodeIds = this.listView;
    return nodeIds.indexOf(nodeId);
  };

  this.getNodeFromPosition = function(pos) {
    var nodeIds = this.listView;
    var id = nodeIds[pos];
    if (id !== undefined) {
      return this.document.get(id);
    } else {
      return null;
    }
  };

  this.getParent = function(nodeId) {
    return this.__parents[nodeId];
  };

  // Get top level parent of given nodeId
  this.getRoot = function(nodeId) {
    var parent = nodeId;

    // Always use top level element for referenceing the node
    while (parent) {
      nodeId = parent;
      parent = this.getParent(nodeId);
    }
    return nodeId;
  };

  this.update = function(op) {
    var path = op.path;
    var needRebuild = (path[0] === this.view.id ||  this.__composites[path[0]] !== undefined);
    if (needRebuild) this.rebuild();
  };

  this.getLength = function() {
    return this.listView.length;
  };

  // Returns true if there is another node after a given position.
  // --------
  //

  this.hasSuccessor = function(nodePos) {
    var l = this.getLength();
    return nodePos < l - 1;
  };

  // Returns true if given view and node pos has a predecessor
  // --------
  //

  this.hasPredecessor = function(nodePos) {
    return nodePos > 0;
  };

  // Get predecessor node for a given view and node id
  // --------
  //

  this.getPredecessor = function(id) {
    var pos = this.getPosition(id);
    if (pos <= 0) return null;
    return this.getNodeFromPosition(pos-1);
  };

  // Get successor node for a given view and node id
  // --------
  //

  this.getSuccessor = function(id) {
    var pos = this.getPosition(id);
    if (pos >= this.getLength() - 1) return null;
    return this.getNodeFromPosition(pos+1);
  };

  this.firstChild = function(node) {
    if (node instanceof Composite) {
      var first = this.document.get(node.getNodes()[0]);
      return this.firstChild(first);
    } else {
      return node;
    }
  };

  this.lastChild = function(node) {
    if (node instanceof Composite) {
      var last = this.document.get(_.last(node.getNodes()));
      return this.lastChild(last);
    } else {
      return node;
    }
  };

  // Provides a document position which addresses begin of a given node
  // --------
  //

  this.before = function(node) {
    var child = this.firstChild(node);
    var nodePos = this.getPosition(child.id);
    return [nodePos, 0];
  };

  // Provides a document position which addresses the end of a given node
  // --------
  //

  this.after = function(node) {
    var child = this.lastChild(node);
    var nodePos = this.getPosition(child.id);
    var charPos = child.getLength();
    return [nodePos, charPos];
  };

};

Container.prototype = _.extend(new Container.Prototype(), util.Events.Listener);

Object.defineProperties(Container.prototype, {
  "id": {
    get: function() { return this.view.id; }
  },
  "type": {
    get: function() { return this.view.type; }
  },
  "nodes": {
    get: function() { return this.view.nodes; },
    set: function(val) { this.view.nodes = val; }
  }
});

module.exports = Container;

},{"../../substance/util":195,"./composite":182,"underscore":198}],184:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var util = require("../../substance/util");

// Document.Controller
// -----------------
//
// Provides means for editing and viewing a Substance.Document. It introduces
// a Selection API in order to move a cursor through the document, support
// copy and paste, etc.
//
// Note: it is quite intentional not to expose the full Substance.Document interface
//       to force us to explicitely take care of model adaptations.
//
// Example usage:
//
//     var doc = new Substance.Document();
//     var editor = new Substance.Document.Controller(doc);
//     var editor.insert("Hello World");

var Controller = function(document, options) {
  options = options || {};
  this.view = options.view || 'content';
  this.__document = document;
  this.container = document.get(this.view);
};

Controller.Prototype = function() {

  // Document Facette
  // --------

  this.getNodes = function(idsOnly) {
    return this.container.getNodes(idsOnly);
  };

  this.getContainer = function() {
    return this.container;
  };

  // Given a node id, get position in the document
  // --------
  //

  this.getPosition = function(id, flat) {
    return this.container.getPosition(id, flat);
  };

  this.getNodeFromPosition = function(nodePos) {
    return this.container.getNodeFromPosition(nodePos);
  };

  // See Annotator
  // --------
  //

  this.getAnnotations = function(options) {
    options = options || {};
    options.view = this.view;
    return this.annotator.getAnnotations(options);
  };

  // Delegate getter
  this.get = function() {
    return this.__document.get.apply(this.__document, arguments);
  };

  this.on = function() {
    return this.__document.on.apply(this.__document, arguments);
  };

  this.off = function() {
    return this.__document.off.apply(this.__document, arguments);
  };

  this.getDocument = function() {
    return this.__document;
  };

};

// Inherit the prototype of Substance.Document which extends util.Events
Controller.prototype = _.extend(new Controller.Prototype(), util.Events.Listener);

// Property accessors for convenient access of primary properties
Object.defineProperties(Controller.prototype, {
  id: {
    get: function() {
      return this.__document.id;
    },
    set: function() { throw "immutable property"; }
  },
  nodeTypes: {
    get: function() {
      return this.__document.nodeTypes;
    },
    set: function() { throw "immutable property"; }
  },
  title: {
    get: function() {
      return this.__document.get('document').title;
    },
    set: function() { throw "immutable property"; }
  },
  updated_at: {
    get: function() {
      return this.__document.get('document').updated_at;
    },
    set: function() { throw "immutable property"; }
  },
  creator: {
    get: function() {
      return this.__document.get('document').creator;
    },
    set: function() { throw "immutable property"; }
  }
});

module.exports = Controller;

},{"../../substance/util":195,"underscore":198}],185:[function(require,module,exports){
"use strict";

// Substance.Document 0.5.0
// (c) 2010-2013 Michael Aufreiter
// Substance.Document may be freely distributed under the MIT license.
// For all details and documentation:
// http://interior.substance.io/modules/document.html


// Import
// ========

var _ = require("underscore");
var util = require("../../substance/util");
var errors = util.errors;
var Data = require("../../substance/data");
//var Operator = require("substance-operator");
//var Chronicle = require("substance-chronicle");
var Container = require("./container");

// Module
// ========

var DocumentError = errors.define("DocumentError");


// Document
// --------
//
// A generic model for representing and transforming digital documents

var Document = function(options) {
  Data.Graph.call(this, options.schema, options);

  this.containers = {};

  this.addIndex("annotations", {
    types: ["annotation"],
    property: "path"
  });
};

// Default Document Schema
// --------

Document.schema = {
  // Static indexes
  "indexes": {
  },

  "types": {
    // Specific type for substance documents, holding all content elements
    "content": {
      "properties": {
      }
    },

    "view": {
      "properties": {
        "nodes": ["array", "content"]
      }
    }
  }
};


Document.Prototype = function() {
  var __super__ = util.prototype(this);

  this.getIndex = function(name) {
    return this.indexes[name];
  };

  this.getSchema = function() {
    return this.schema;
  };

  this.create = function(node) {
    __super__.create.call(this, node);
    return this.get(node.id);
  };

  // Delegates to Graph.get but wraps the result in the particular node constructor
  // --------
  //

  this.get = function(path) {
    var node = __super__.get.call(this, path);

    if (!node) return node;

    // Wrap all views in Container instances
    if (node.type === "view") {
      if (!this.containers[node.id]) {
        this.containers[node.id] = new Container(this, node);
      }
      return this.containers[node.id];
    }

    // Wrap all nodes in an appropriate Node instance
    else {
      var nodeSpec = this.nodeTypes[node.type];
      var NodeType = (nodeSpec !== undefined) ? nodeSpec.Model : null;
      if (NodeType && !(node instanceof NodeType)) {
        node = new NodeType(node, this);
        this.nodes[node.id] = node;
      }

      return node;
    }
  };

  // Serialize to JSON
  // --------
  //
  // The command is converted into a sequence of graph commands

  this.toJSON = function() {
    var res = __super__.toJSON.call(this);
    res.id = this.id;
    return res;
  };

  // Hide elements from provided view
  // --------
  //

  this.hide = function(viewId, nodes) {
    var view = this.get(viewId);

    if (!view) {
      throw new DocumentError("Invalid view id: "+ viewId);
    }

    if (_.isString(nodes)) {
      nodes = [nodes];
    }

    var indexes = [];
    _.each(nodes, function(n) {
      var i = view.nodes.indexOf(n);
      if (i>=0) indexes.push(i);
    }, this);

    if (indexes.length === 0) return;

    indexes = indexes.sort().reverse();
    indexes = _.uniq(indexes);

    var container = this.nodes[viewId];
    for (var i = 0; i < indexes.length; i++) {
      container.nodes.splice(indexes[i], 1);
    }
  };

  // Adds nodes to a view
  // --------
  //

  this.show = function(viewId, nodeId, target) {
    if (target === undefined) target = -1;

    var view = this.get(viewId);
    if (!view) {
      throw new DocumentError("Invalid view id: " + viewId);
    }

    var l = view.nodes.length;

    // target index can be given as negative number (as known from python/ruby)
    target = Math.min(target, l);
    if (target<0) target = Math.max(0, l+target+1);

    view.nodes.splice(target, 0, nodeId);
  };

  this.fromSnapshot = function(data, options) {
    return Document.fromSnapshot(data, options);
  };

  this.uuid = function(type) {
    return type + "_" + util.uuid();
  };
};

Document.Prototype.prototype = Data.Graph.prototype;
Document.prototype = new Document.Prototype();

Document.fromSnapshot = function(data, options) {
  options = options || {};
  options.seed = data;
  return new Document(options);
};


Document.DocumentError = DocumentError;

// Export
// ========

module.exports = Document;

},{"../../substance/data":179,"../../substance/util":195,"./container":183,"underscore":198}],186:[function(require,module,exports){
"use strict";

var _ = require("underscore");

var Document = require('./document');
Document.Container = require('./container');
Document.Controller = require('./controller');
Document.Node = require('./node');
Document.Composite = require('./composite');
// TODO: this should also be moved to 'substance-nodes'
// However, currently there is too much useful in it that is also necessary for the test-suite
// Maybe, we should extract such things into helper functions so that it is easier to
// create custom text based, annotatable nodes.
Document.TextNode = require('./text_node');

module.exports = Document;

},{"./composite":182,"./container":183,"./controller":184,"./document":185,"./node":187,"./text_node":188,"underscore":198}],187:[function(require,module,exports){
"use strict";

var _ = require("underscore");

// Substance.Node
// -----------------

var Node = function(node, document) {
  this.document = document;
  this.properties = node;
};

// Type definition
// --------
//

Node.type = {
  "parent": "content",
  "properties": {
  }
};

// Define node behavior
// --------
// These properties define the default behavior of a node, e.g., used when manipulating the document.
// Sub-types override these settings
// Note: it is quite experimental, and we will consolidate them soon.

Node.properties = {
  abstract: true,
  immutable: true,
  mergeableWith: [],
  preventEmpty: true,
  allowedAnnotations: []
};

Node.Prototype = function() {

  this.toJSON = function() {
    return _.clone(this.properties);
  };

  // Provides the number of characters contained by this node.
  // --------
  // We use characters as a general concept, i.e., they do not
  // necessarily map to real characters.
  // Basically it is used for navigation and positioning.

  this.getLength = function() {
    throw new Error("Node.getLength() is abstract.");
  };

  // Provides how a cursor would change by an operation
  // --------
  //

  this.getChangePosition = function(op) {
    throw new Error("Node.getCharPosition() is abstract.");
  };

  // Provides an operation that can be used to insert
  // text at the given position.
  // --------
  //

  this.insertOperation = function(charPos, text) {
    throw new Error("Node.insertOperation() is abstract.");
  };

  // Provides an operation that can be used to delete a given range.
  // --------
  //

  this.deleteOperation = function(startChar, endChar) {
    throw new Error("Node.deleteOperation() is abstract.");
  };

  // Note: this API is rather experimental
  // It is used to dynamically control the behavior for modifications
  // e.g., via an editor

  // Can this node be joined with another one?
  // --------

  this.canJoin = function(other) {
    return false;
  };

  // Appends the content of another node
  // --------

  this.join = function(other) {
    throw new Error("Node.join() is abstract.");
  };

  // Can a 'hard-break' be applied to this node?
  // --------

  this.isBreakable = function() {
    return false;
  };

  // Breaks this node at a given position
  // --------

  this.break = function(doc, pos) {
    throw new Error("Node.split() is abstract.");
  };

  this.getAnnotations = function() {
    return this.document.getIndex("annotations").get(this.properties.id);
  };

  this.includeInToc = function() {
    return false;
  };
};

Node.prototype = new Node.Prototype();
Node.prototype.constructor = Node;

Node.defineProperties = function(NodeClassOrNodePrototype, properties, readonly) {
  var NodePrototype = NodeClassOrNodePrototype;

  if (arguments.length === 1) {
    var NodeClass = NodeClassOrNodePrototype;
    NodePrototype = NodeClass.prototype;
    if (!NodePrototype || !NodeClass.type) {
      throw new Error("Illegal argument: expected NodeClass");
    }
    properties = Object.keys(NodeClass.type.properties);
  }

  _.each(properties, function(name) {
    var spec = {
      get: function() {
        return this.properties[name];
      }
    }
    if (!readonly) {
      spec["set"] = function(val) {
        this.properties[name] = val;
        return this;
      }
    }
    Object.defineProperty(NodePrototype, name, spec);
  });
};

Node.defineProperties(Node.prototype, ["id", "type"]);

module.exports = Node;

},{"underscore":198}],188:[function(require,module,exports){
"use strict";

var DocumentNode = require("./node");

// Substance.Text
// -----------------
//

var Text = function(node, document) {
  DocumentNode.call(this, node, document);
};


Text.type = {
  "id": "text",
  "parent": "content",
  "properties": {
    "source_id": "Text element source id",
    "content": "string"
  }
};


// This is used for the auto-generated docs
// -----------------
//

Text.description = {
  "name": "Text",
  "remarks": [
    "A simple text fragement that can be annotated. Usually text nodes are combined in a paragraph.",
  ],
  "properties": {
    "content": "Content",
  }
};


// Example Paragraph
// -----------------
//

Text.example = {
  "type": "paragraph",
  "id": "paragraph_1",
  "content": "Lorem ipsum dolor sit amet, adipiscing elit.",
};


Text.Prototype = function() {
  this.getLength = function() {
    return this.properties.content.length;
  };
};

Text.Prototype.prototype = DocumentNode.prototype;
Text.prototype = new Text.Prototype();
Text.prototype.constructor = Text;

DocumentNode.defineProperties(Text.prototype, ["content"]);

module.exports = Text;

},{"./node":187}],189:[function(require,module,exports){
"use strict";

var _ = require("underscore");
var util = require("./util.js");

// Helpers for Asynchronous Control Flow
// --------

var async = {};

function callAsynchronousChain(options, cb) {
  var _finally = options["finally"] || function(err, data) { cb(err, data); };
  _finally = _.once(_finally);
  var data = options.data || {};
  var functions = options.functions;

  if (!_.isFunction(cb)) {
    return cb("Illegal arguments: a callback function must be provided");
  }

  var index = 0;
  var stopOnError = (options.stopOnError===undefined) ? true : options.stopOnError;
  var errors = [];

  function process(data) {
    var func = functions[index];

    // stop if no function is left
    if (!func) {
      if (errors.length > 0) {
        return _finally(new Error("Multiple errors occurred.", data));
      } else {
        return _finally(null, data);
      }
    }

    // A function that is used as call back for each function
    // which does the progression in the chain via recursion.
    // On errors the given callback will be called and recursion is stopped.
    var recursiveCallback = _.once(function(err, data) {
      // stop on error
      if (err) {
        if (stopOnError) {
          return _finally(err, null);
        } else {
          errors.push(err);
        }
      }

      index += 1;
      process(data);
    });

    // catch exceptions and propagat
    try {
      if (func.length === 0) {
        func();
        recursiveCallback(null, data);
      }
      else if (func.length === 1) {
        func(recursiveCallback);
      }
      else {
        func(data, recursiveCallback);
      }
    } catch (err) {
      console.log("util.async caught error:", err);
      util.printStackTrace(err);
      _finally(err);
    }
  }

  // start processing
  process(data);
}

// Calls a given list of asynchronous functions sequentially
// -------------------
// options:
//    functions:  an array of functions of the form f(data,cb)
//    data:       data provided to the first function; optional
//    finally:    a function that will always be called at the end, also on errors; optional

async.sequential = function(options, cb) {
  // allow to call this with an array of functions instead of options
  if(_.isArray(options)) {
    options = { functions: options };
  }
  callAsynchronousChain(options, cb);
};

function asynchronousIterator(options) {
  return function(data, cb) {
    // retrieve items via selector if a selector function is given
    var items = options.selector ? options.selector(data) : options.items;
    var _finally = options["finally"] || function(err, data) { cb(err, data); };
    _finally = _.once(_finally);

    // don't do nothing if no items are given
    if (!items) {
      return _finally(null, data);
    }

    var isArray = _.isArray(items);

    if (options.before) {
      options.before(data);
    }

    var funcs = [];
    var iterator = options.iterator;

    // TODO: discuss convention for iterator function signatures.
    // trying to achieve a combination of underscore and node.js callback style
    function arrayFunction(item, index) {
      return function(data, cb) {
        if (iterator.length === 2) {
          iterator(item, cb);
        } else if (iterator.length === 3) {
          iterator(item, index, cb);
        } else {
          iterator(item, index, data, cb);
        }
      };
    }

    function objectFunction(value, key) {
      return function(data, cb) {
        if (iterator.length === 2) {
          iterator(value, cb);
        } else if (iterator.length === 3) {
          iterator(value, key, cb);
        } else {
          iterator(value, key, data, cb);
        }
      };
    }

    if (isArray) {
      for (var idx = 0; idx < items.length; idx++) {
        funcs.push(arrayFunction(items[idx], idx));
      }
    } else {
      for (var key in items) {
        funcs.push(objectFunction(items[key], key));
      }
    }

    //console.log("Iterator:", iterator, "Funcs:", funcs);
    var chainOptions = {
      functions: funcs,
      data: data,
      finally: _finally,
      stopOnError: options.stopOnError
    };
    callAsynchronousChain(chainOptions, cb);
  };
}

// Creates an each-iterator for util.async chains
// -----------
//
//     var func = util.async.each(items, function(item, [idx, [data,]] cb) { ... });
//     var func = util.async.each(options)
//
// options:
//    items:    the items to be iterated
//    selector: used to select items dynamically from the data provided by the previous function in the chain
//    before:   an extra function called before iteration
//    iterator: the iterator function (item, [idx, [data,]] cb)
//       with item: the iterated item,
//            data: the propagated data (optional)
//            cb:   the callback

// TODO: support only one version and add another function
async.iterator = function(options_or_items, iterator) {
  var options;
  if (arguments.length == 1) {
    options = options_or_items;
  } else {
    options = {
      items: options_or_items,
      iterator: iterator
    };
  }
  return asynchronousIterator(options);
};

async.each = function(options, cb) {
  // create the iterator and call instantly
  var f = asynchronousIterator(options);
  f(null, cb);
};

module.exports = async;

},{"./util.js":197,"underscore":198}],190:[function(require,module,exports){
"use strict";

var _ = require("underscore");

// Helpers for working with the DOM

var dom = {};

dom.ChildNodeIterator = function(arg) {
  if(_.isArray(arg)) {
    this.nodes = arg;
  } else {
    this.nodes = arg.childNodes;
  }
  this.length = this.nodes.length;
  this.pos = -1;
};

dom.ChildNodeIterator.prototype = {
  hasNext: function() {
    return this.pos < this.length - 1;
  },

  next: function() {
    this.pos += 1;
    return this.nodes[this.pos];
  },

  back: function() {
    if (this.pos >= 0) {
      this.pos -= 1;
    }
    return this;
  }
};

// Note: it is not safe regarding browser in-compatibilities
// to access el.children directly.
dom.getChildren = function(el) {
  if (el.children !== undefined) return el.children;
  var children = [];
  var child = el.firstElementChild;
  while (child) {
    children.push(child);
    child = child.nextElementSibling;
  }
  return children;
};

dom.getNodeType = function(el) {
  if (el.nodeType === window.Node.TEXT_NODE) {
    return "text";
  } else if (el.nodeType === window.Node.COMMENT_NODE) {
    return "comment";
  } else if (el.tagName) {
    return el.tagName.toLowerCase();
  } else {
    console.error("Can't get node type for ", el);
    return "unknown";
  }
};

module.exports = dom;

},{"underscore":198}],191:[function(require,module,exports){
"use strict";

var util = require('./util');

var errors = {};

// The base class for Substance Errors
// -------
// We have been not so happy with the native error as it is really poor with respect to
// stack information and presentation.
// This implementation has a more usable stack trace which is rendered using `err.printStacktrace()`.
// Moreover, it provides error codes and error chaining.
var SubstanceError = function(message, rootError) {

  // If a root error is given try to take over as much information as possible
  if (rootError) {
    Error.call(this, message, rootError.fileName, rootError.lineNumber);

    if (rootError instanceof SubstanceError) {
      this.__stack = rootError.__stack;
    } else if (rootError.stack) {
      this.__stack = util.parseStackTrace(rootError);
    } else {
      this.__stack = util.callstack(1);
    }

  }

  // otherwise create a new stacktrace
  else {
    Error.call(this, message);
    this.__stack = util.callstack(1);
  }

  this.message = message;
};

SubstanceError.Prototype = function() {

  this.name = "SubstanceError";
  this.code = -1;

  this.toString = function() {
    return this.name+":"+this.message;
  };

  this.toJSON = function() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      stack: this.stack
    };
  };

  this.printStackTrace = function() {
    util.printStackTrace(this);
  };
};

SubstanceError.Prototype.prototype = Error.prototype;
SubstanceError.prototype = new SubstanceError.Prototype();

Object.defineProperty(SubstanceError.prototype, "stack", {
  get: function() {
    var str = [];
    for (var idx = 0; idx < this.__stack.length; idx++) {
      var s = this.__stack[idx];
      str.push(s.file+":"+s.line+":"+s.col+" ("+s.func+")");
    }
    return str.join("\n");
  },
  set: function() { throw new Error("SubstanceError.stack is read-only."); }
});

errors.SubstanceError = SubstanceError;


var createSubstanceErrorSubclass = function(parent, name, code) {
  return function(message) {
    parent.call(this, message);
    this.name = name;
    this.code = code;
  };
};

errors.define = function(className, code, parent) {
  if (!className) throw new SubstanceError("Name is required.");
  if (code === undefined) code = -1;

  parent = parent || SubstanceError;
  var ErrorClass = createSubstanceErrorSubclass(parent, className, code);
  var ErrorClassPrototype = function() {};
  ErrorClassPrototype.prototype = parent.prototype;
  ErrorClass.prototype = new ErrorClassPrototype();
  ErrorClass.prototype.constructor = ErrorClass;

  errors[className] = ErrorClass;
  return ErrorClass;
};

module.exports = errors;

},{"./util":197}],192:[function(require,module,exports){
"use strict";

var _ = require("underscore");

var ENTER = 1;
var EXIT = -1;

// Fragmenter
// --------
//
// An algorithm that is used to fragment overlapping structure elements
// following a priority rule set.
// E.g., we use this for creating DOM elements for annotations. The annotations
// can partially be overlapping. However this is not allowed in general for DOM elements
// or other hierarchical structures.
//
// Example: For the Annotation use casec consider a 'comment' spanning partially
// over an 'emphasis' annotation.
// 'The <comment>quick brown <bold>fox</comment> jumps over</bold> the lazy dog.'
// We want to be able to create a valid XML structure:
// 'The <comment>quick brown <bold>fox</bold></comment><bold> jumps over</bold> the lazy dog.'
//
// For that one would choose
//
//     {
//        'comment': 0,
//        'bold': 1
//     }
//
// as priority levels.
// In case of structural violations as in the example, elements with a higher level
// would be fragmented and those with lower levels would be preserved as one piece.
//
// TODO: If a violation for nodes of the same level occurs an Error should be thrown.
// Currently, in such cases the first element that is opened earlier is preserved.

var Fragmenter = function(levels) {
  this.levels = levels || {};
};

Fragmenter.Prototype = function() {

  // This is a sweep algorithm wich uses a set of ENTER/EXIT entries
  // to manage a stack of active elements.
  // Whenever a new element is entered it will be appended to its parent element.
  // The stack is ordered by the annotation types.
  //
  // Examples:
  //
  // - simple case:
  //
  //       [top] -> ENTER(idea1) -> [top, idea1]
  //
  //   Creates a new 'idea' element and appends it to 'top'
  //
  // - stacked ENTER:
  //
  //       [top, idea1] -> ENTER(bold1) -> [top, idea1, bold1]
  //
  //   Creates a new 'bold' element and appends it to 'idea1'
  //
  // - simple EXIT:
  //
  //       [top, idea1] -> EXIT(idea1) -> [top]
  //
  //   Removes 'idea1' from stack.
  //
  // - reordering ENTER:
  //
  //       [top, bold1] -> ENTER(idea1) -> [top, idea1, bold1]
  //
  //   Inserts 'idea1' at 2nd position, creates a new 'bold1', and appends itself to 'top'
  //
  // - reordering EXIT
  //
  //       [top, idea1, bold1] -> EXIT(idea1)) -> [top, bold1]
  //
  //   Removes 'idea1' from stack and creates a new 'bold1'
  //

  // Orders sweep events according to following precedences:
  //
  // 1. pos
  // 2. EXIT < ENTER
  // 3. if both ENTER: ascending level
  // 4. if both EXIT: descending level

  var _compare = function(a, b) {
    if (a.pos < b.pos) return -1;
    if (a.pos > b.pos) return 1;

    if (a.mode < b.mode) return -1;
    if (a.mode > b.mode) return 1;

    if (a.mode === ENTER) {
      if (a.level < b.level) return -1;
      if (a.level > b.level) return 1;
    }

    if (a.mode === EXIT) {
      if (a.level > b.level) return -1;
      if (a.level < b.level) return 1;
    }

    return 0;
  };

  var extractEntries = function(annotations) {
    var entries = [];
    _.each(annotations, function(a) {
      // use a weak default level when not given
      var l = this.levels[a.type] || 1000;

      // ignore annotations that are not registered
      if (l === undefined) {
        return;
      }

      entries.push({ pos : a.range[0], mode: ENTER, level: l, id: a.id, type: a.type, node: a });
      entries.push({ pos : a.range[1], mode: EXIT, level: l, id: a.id, type: a.type, node: a });
    }, this);
    return entries;
  };

  this.onText = function(/*context, text*/) {};

  // should return the created user context
  this.onEnter = function(/*entry, parentContext*/) {
    return null;
  };
  this.onExit = function(/*entry, parentContext*/) {};

  this.enter = function(entry, parentContext) {
    return this.onEnter(entry, parentContext);
  };

  this.exit = function(entry, parentContext) {
    this.onExit(entry, parentContext);
  };

  this.createText = function(context, text) {
    this.onText(context, text);
  };

  this.start = function(rootContext, text, annotations) {
    var entries = extractEntries.call(this, annotations);
    entries.sort(_compare.bind(this));

    var stack = [{context: rootContext, entry: null}];

    var pos = 0;

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];

      // in any case we add the last text to the current element
      this.createText(stack[stack.length-1].context, text.substring(pos, entry.pos));

      pos = entry.pos;
      var level = 1;

      var idx;

      if (entry.mode === ENTER) {
        // find the correct position and insert an entry
        for (; level < stack.length; level++) {
          if (entry.level < stack[level].entry.level) {
            break;
          }
        }
        stack.splice(level, 0, {entry: entry});
      }
      else if (entry.mode === EXIT) {
        // find the according entry and remove it from the stack
        for (; level < stack.length; level++) {
          if (stack[level].entry.id === entry.id) {
            break;
          }
        }
        for (idx = level; idx < stack.length; idx++) {
          this.exit(stack[idx].entry, stack[idx-1].context);
        }
        stack.splice(level, 1);
      }

      // create new elements for all lower entries
      for (idx = level; idx < stack.length; idx++) {
        stack[idx].context = this.enter(stack[idx].entry, stack[idx-1].context);
      }
    }

    // Finally append a trailing text node
    this.createText(rootContext, text.substring(pos));
  };

};
Fragmenter.prototype = new Fragmenter.Prototype();

module.exports = Fragmenter;

},{"underscore":198}],193:[function(require,module,exports){
'use strict';

var _ = require("underscore");
var map = _.map;
var forEach = _.each;

/*
  Calculate a bounding rectangle for a set of rectangles.

  Note: Here, `bounds.right` and `bounds.bottom` are relative to
  the left top of the viewport.
*/
function _getBoundingRect(rects) {
  var bounds = {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
    width: Number.NaN,
    height: Number.NaN
  };

  forEach(rects, function(rect) {
    if (rect.left < bounds.left) {
      bounds.left = rect.left;
    }
    if (rect.top < bounds.top) {
      bounds.top = rect.top;
    }
    if (rect.left + rect.width > bounds.right) {
      bounds.right = rect.left + rect.width;
    }
    if (rect.top + rect.height > bounds.bottom) {
      bounds.bottom = rect.top + rect.height;
    }
  });
  bounds.width = bounds.right - bounds.left;
  bounds.height = bounds.bottom - bounds.top;
  return bounds;
}

/*
  Calculate the bounding rect of a single element relative to a parent.

  The rectangle dimensions are calculated as the union of the given elements
  clientRects. A selection fragment, for example, may appear as a multi-line span
  element that consists of a single client rect per line of text in variable widths.
*/
function _getBoundingOffsetsRect(el, relativeParentEl) {
  var relativeParentElRect = relativeParentEl.getBoundingClientRect();
  var elRect = _getBoundingRect(el.getClientRects());

  var left = elRect.left - relativeParentElRect.left;
  var top = elRect.top - relativeParentElRect.top;
  return {
    left: left,
    top: top,
    right: relativeParentElRect.width - left - elRect.width,
    bottom: relativeParentElRect.height - top - elRect.height,
    width: elRect.width,
    height: elRect.height
  };
}

/**
  Get bounding rectangle relative to a given parent element. Allows multiple
  elements being passed (we need this for selections that consist of multiple
  selection fragments). Takes a relative parent element that is used as a
  reference point, instead of the browser's viewport.

  @param {Array} els elements to compute the bounding rectangle for
  @param {DOMElement} containerEl relative parent used as a reference point
  @return {object} rectangle description with left, top, right, bottom, width and height
*/
function getRelativeBoundingRect(els, containerEl) {
  if (els.length === undefined) {
    els = [els];
  }
  var elRects = map(els, function(el) {
    return _getBoundingOffsetsRect(el, containerEl);
  });

  var elsRect = _getBoundingRect(elRects);
  var containerElRect = containerEl.getBoundingClientRect();
  return {
    left: elsRect.left,
    top: elsRect.top,
    right: containerElRect.width - elsRect.left - elsRect.width,
    bottom: containerElRect.height - elsRect.top - elsRect.height,
    width: elsRect.width,
    height: elsRect.height
  };
}

module.exports = getRelativeBoundingRect;
},{"underscore":198}],194:[function(require,module,exports){
"use strict";

var html = {};
var _ = require("underscore");

html.templates = {};

// html.compileTemplate = function(tplName) {
//   var rawTemplate = $('script[name='+tplName+']').html();
//   html.templates[tplName] = Handlebars.compile(rawTemplate);
// };

html.renderTemplate = function(tplName, data) {
  return html.templates[tplName](data);
};

// Handlebars.registerHelper('ifelse', function(cond, textIf, textElse) {
//   textIf = Handlebars.Utils.escapeExpression(textIf);
//   textElse  = Handlebars.Utils.escapeExpression(textElse);
//   return new Handlebars.SafeString(cond ? textIf : textElse);
// });

if (typeof window !== "undefined") {
  // A fake console to calm down some browsers.
  if (!window.console) {
    window.console = {
      log: function() {
        // No-op
      }
    };
  }
}

// Render Underscore templates
html.tpl = function (tpl, ctx) {
  ctx = ctx || {};
  var source = window.$('script[name='+tpl+']').html();
  return _.template(source, ctx);
};

// Exports
// ====

module.exports = html;

},{"underscore":198}],195:[function(require,module,exports){
"use strict";

var util = require("./util");

util.async = require("./async");
util.errors = require("./errors");
util.html = require("./html");
util.dom = require("./dom");
util.RegExp = require("./regexp");
util.Fragmenter = require("./fragmenter");

module.exports = util;

},{"./async":189,"./dom":190,"./errors":191,"./fragmenter":192,"./html":194,"./regexp":196,"./util":197}],196:[function(require,module,exports){
"use strict";

// Substanc.RegExp.Match
// ================
//
// Regular expressions in Javascript they way they should be.

var Match = function(match) {
  this.index = match.index;
  this.match = [];

  for (var i=0; i < match.length; i++) {
    this.match.push(match[i]);
  }
};

Match.Prototype = function() {

  // Returns the capture groups
  // --------
  //

  this.captures = function() {
    return this.match.slice(1);
  };

  // Serialize to string
  // --------
  //

  this.toString = function() {
    return this.match[0];
  };
};

Match.prototype = new Match.Prototype();

// Substance.RegExp
// ================
//

var RegExp = function(exp) {
  this.exp = exp;
};

RegExp.Prototype = function() {

  this.match = function(str) {
    if (str === undefined) throw new Error('No string given');

    if (!this.exp.global) {
      return this.exp.exec(str);
    } else {
      var matches = [];
      var match;
      // Reset the state of the expression
      this.exp.compile(this.exp);

      // Execute until last match has been found

      while ((match = this.exp.exec(str)) !== null) {
        matches.push(new Match(match));
      }
      return matches;
    }
  };
};

RegExp.prototype = new RegExp.Prototype();

RegExp.Match = Match;


// Export
// ========

module.exports = RegExp;

},{}],197:[function(require,module,exports){
"use strict";

// Imports
// ====

var _ = require('underscore');

// Module
// ====

var util = {};

// UUID Generator
// -----------------

/*!
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

util.uuid = function (prefix, len) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyz'.split(''),
      uuid = [],
      radix = 16,
      idx;
  len = len || 32;

  if (len) {
    // Compact form
    for (idx = 0; idx < len; idx++) uuid[idx] = chars[0 | Math.random()*radix];
  } else {
    // rfc4122, version 4 form
    var r;

    // rfc4122 requires these characters
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
    for (idx = 0; idx < 36; idx++) {
      if (!uuid[idx]) {
        r = 0 | Math.random()*16;
        uuid[idx] = chars[(idx == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
  }
  return (prefix ? prefix : "") + uuid.join('');
};

// creates a uuid function that generates counting uuids
util.uuidGen = function(defaultPrefix) {
  var id = 1;
  defaultPrefix = (defaultPrefix !== undefined) ? defaultPrefix : "uuid_";
  return function(prefix) {
    prefix = prefix || defaultPrefix;
    return prefix+(id++);
  };
};


// Events
// ---------------

// Taken from Backbone.js
//
// A module that can be mixed in to *any object* in order to provide it with
// custom events. You may bind with `on` or remove with `off` callback
// functions to an event; `trigger`-ing an event fires all callbacks in
// succession.
//
//     var object = {};
//     _.extend(object, util.Events);
//     object.on('expand', function(){ alert('expanded'); });
//     object.trigger('expand');
//

// A difficult-to-believe, but optimized internal dispatch function for
// triggering events. Tries to keep the usual cases speedy (most internal
// Backbone events have 3 arguments).
var triggerEvents = function(events, args) {
  var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
  switch (args.length) {
    case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
    case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
    case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
    case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
    default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
  }
};

// Regular expression used to split event strings.
var eventSplitter = /\s+/;

// Implement fancy features of the Events API such as multiple event
// names `"change blur"` and jQuery-style event maps `{change: action}`
// in terms of the existing API.
var eventsApi = function(obj, action, name, rest) {
  if (!name) return true;

  // Handle event maps.
  if (typeof name === 'object') {
    for (var key in name) {
      obj[action].apply(obj, [key, name[key]].concat(rest));
    }
    return false;
  }

  // Handle space separated event names.
  if (eventSplitter.test(name)) {
    var names = name.split(eventSplitter);
    for (var i = 0, l = names.length; i < l; i++) {
      obj[action].apply(obj, [names[i]].concat(rest));
    }
    return false;
  }

  return true;
};

util.Events = {

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  on: function(name, callback, context) {
    if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
    this._events =  this._events || {};
    var events = this._events[name] || (this._events[name] = []);
    events.push({callback: callback, context: context, ctx: context || this});
    return this;
  },

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, it will be removed.
  once: function(name, callback, context) {
    if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
    var self = this;
    var once = _.once(function() {
      self.off(name, once);
      callback.apply(this, arguments);
    });
    once._callback = callback;
    return this.on(name, once, context);
  },

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  off: function(name, callback, context) {
    var retain, ev, events, names, i, l, j, k;
    if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
    if (!name && !callback && !context) {
      this._events = {};
      return this;
    }

    names = name ? [name] : _.keys(this._events);
    for (i = 0, l = names.length; i < l; i++) {
      name = names[i];
      events = this._events[name];
      if (events) {
        this._events[name] = retain = [];
        if (callback || context) {
          for (j = 0, k = events.length; j < k; j++) {
            ev = events[j];
            if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                (context && context !== ev.context)) {
              retain.push(ev);
            }
          }
        }
        if (!retain.length) delete this._events[name];
      }
    }

    return this;
  },

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  trigger: function(name) {
    if (!this._events) return this;
    var args = Array.prototype.slice.call(arguments, 1);
    if (!eventsApi(this, 'trigger', name, args)) return this;
    var events = this._events[name];
    var allEvents = this._events.all;
    if (events) triggerEvents(events, args);
    if (allEvents) triggerEvents(allEvents, arguments);
    return this;
  },

  triggerLater: function() {
    var self = this;
    var _arguments = arguments;
    window.setTimeout(function() {
      self.trigger.apply(self, _arguments);
    }, 0);
  },

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  stopListening: function(obj, name, callback) {
    var listeners = this._listeners;
    if (!listeners) return this;
    var deleteListener = !name && !callback;
    if (typeof name === 'object') callback = this;
    if (obj) (listeners = {})[obj._listenerId] = obj;
    for (var id in listeners) {
      listeners[id].off(name, callback, this);
      if (deleteListener) delete this._listeners[id];
    }
    return this;
  }

};

var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

// Inversion-of-control versions of `on` and `once`. Tell *this* object to
// listen to an event in another object ... keeping track of what it's
// listening to.
_.each(listenMethods, function(implementation, method) {
  util.Events[method] = function(obj, name, callback) {
    var listeners = this._listeners || (this._listeners = {});
    var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
    listeners[id] = obj;
    if (typeof name === 'object') callback = this;
    obj[implementation](name, callback, this);
    return this;
  };
});

// Aliases for backwards compatibility.
util.Events.bind   = util.Events.on;
util.Events.unbind = util.Events.off;

util.Events.Listener = {

  listenTo: function(obj, name, callback) {
    if (!_.isFunction(callback)) {
      throw new Error("Illegal argument: expecting function as callback, was: " + callback);
    }

    // initialize container for keeping handlers to unbind later
    this._handlers = this._handlers || [];

    obj.on(name, callback, this);

    this._handlers.push({
      unbind: function() {
        obj.off(name, callback);
      }
    });

    return this;
  },

  stopListening: function() {
    if (this._handlers) {
      for (var i = 0; i < this._handlers.length; i++) {
        this._handlers[i].unbind();
      }
    }
  }

};

util.propagate = function(data, cb) {
  if(!_.isFunction(cb)) {
    throw "Illegal argument: provided callback is not a function";
  }
  return function(err) {
    if (err) return cb(err);
    cb(null, data);
  };
};

// shamelessly stolen from backbone.js:
// Helper function to correctly set up the prototype chain, for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
var ctor = function(){};
util.inherits = function(parent, protoProps, staticProps) {
  var child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent's constructor.
  if (protoProps && protoProps.hasOwnProperty('constructor')) {
    child = protoProps.constructor;
  } else {
    child = function(){ parent.apply(this, arguments); };
  }

  // Inherit class (static) properties from parent.
  _.extend(child, parent);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function.
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();

  // Add prototype properties (instance properties) to the subclass,
  // if supplied.
  if (protoProps) _.extend(child.prototype, protoProps);

  // Add static properties to the constructor function, if supplied.
  if (staticProps) _.extend(child, staticProps);

  // Correctly set child's `prototype.constructor`.
  child.prototype.constructor = child;

  // Set a convenience property in case the parent's prototype is needed later.
  child.__super__ = parent.prototype;

  return child;
};

// Util to read seed data from file system
// ----------

util.getJSON = function(resource, cb) {
  if (typeof window === 'undefined' || typeof nwglobal !== 'undefined') {
    var fs = require('fs');
    var obj = JSON.parse(fs.readFileSync(resource, 'utf8'));
    cb(null, obj);
  } else {
    //console.log("util.getJSON", resource);
    var $ = window.$;
    $.getJSON(resource)
      .done(function(obj) { cb(null, obj); })
      .error(function(err) { cb(err, null); });
  }
};

util.prototype = function(that) {
  /*jshint proto: true*/ // supressing a warning about using deprecated __proto__.
  return Object.getPrototypeOf ? Object.getPrototypeOf(that) : that.__proto__;
};

util.inherit = function(Super, Self) {
  var super_proto = _.isFunction(Super) ? new Super() : Super;
  var proto;
  if (_.isFunction(Self)) {
    Self.prototype = super_proto;
    proto = new Self();
  } else {
    var TmpClass = function(){};
    TmpClass.prototype = super_proto;
    proto = _.extend(new TmpClass(), Self);
  }
  return proto;
};

util.pimpl = function(pimpl) {
  var Pimpl = function(self) {
    this.self = self;
  };
  Pimpl.prototype = pimpl;
  return function(self) { self = self || this; return new Pimpl(self); };
};

util.parseStackTrace = function(err) {
  var SAFARI_STACK_ELEM = /([^@]*)@(.*):(\d+)/;
  var CHROME_STACK_ELEM = /\s*at ([^(]*)[(](.*):(\d+):(\d+)[)]/;

  var idx;
  var stackTrace = err.stack.split('\n');

  // parse the stack trace: each line is a tuple (function, file, lineNumber)
  // Note: unfortunately this is interpreter specific
  // safari: "<function>@<file>:<lineNumber>"
  // chrome: "at <function>(<file>:<line>:<col>"

  var stack = [];
  for (idx = 0; idx < stackTrace.length; idx++) {
    var match = SAFARI_STACK_ELEM.exec(stackTrace[idx]);
    if (!match) match = CHROME_STACK_ELEM.exec(stackTrace[idx]);
    var entry;
    if (match) {
      entry = {
        func: match[1],
        file: match[2],
        line: match[3],
        col: match[4] || 0
      };
      if (entry.func === "") entry.func = "<anonymous>";
    } else {
      entry = {
        func: "",
        file: stackTrace[idx],
        line: "",
        col: ""
      };
    }
    stack.push(entry);
  }

  return stack;
};

util.callstack = function(k) {
  var err;
  try { throw new Error(); } catch (_err) { err = _err; }
  var stack = util.parseStackTrace(err);
  k = k || 0;
  return stack.splice(k+1);
};

util.stacktrace = function (err) {
  var stack = (arguments.length === 0) ? util.callstack().splice(1) : util.parseStackTrace(err);
  var str = [];
  _.each(stack, function(s) {
    str.push(s.file+":"+s.line+":"+s.col+" ("+s.func+")");
  });
  return str.join("\n");
};

util.printStackTrace = function(err, N) {
  if (!err.stack) return;

  var stack;

  // Substance errors have a nice stack already
  if (err.__stack !== undefined) {
    stack = err.__stack;
  }
  // built-in errors have the stack trace as one string
  else if (_.isString(err.stack)) {
    stack = util.parseStackTrace(err);
  }
  else return;

  N = N || stack.length;
  N = Math.min(N, stack.length);

  for (var idx = 0; idx < N; idx++) {
    var s = stack[idx];
    console.log(s.file+":"+s.line+":"+s.col, "("+s.func+")");
  }
};

// computes the difference of obj1 to obj2
util.diff = function(obj1, obj2) {
  var diff;
  if (_.isArray(obj1) && _.isArray(obj2)) {
    diff = _.difference(obj2, obj1);
    // return null in case of equality
    if (diff.length === 0) return null;
    else return diff;
  }
  if (_.isObject(obj1) && _.isObject(obj2)) {
    diff = {};
    _.each(Object.keys(obj2), function(key) {
      var d = util.diff(obj1[key], obj2[key]);
      if (d) diff[key] = d;
    });
    // return null in case of equality
    if (_.isEmpty(diff)) return null;
    else return diff;
  }
  if(obj1 !== obj2) return obj2;
};

// Deep-Clone a given object
// --------
// Note: this is currently done via JSON.parse(JSON.stringify(obj))
//       which is in fact not optimal, as it depends on `toJSON` implementation.
util.deepclone = function(obj) {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  return JSON.parse(JSON.stringify(obj));
};

// Clones a given object
// --------
// Calls obj's `clone` function if available,
// otherwise clones the obj using `util.deepclone()`.
util.clone = function(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (_.isFunction(obj.clone)) {
    return obj.clone();
  }
  return util.deepclone(obj);
};

util.freeze = function(obj) {
  var idx;
  if (_.isObject(obj)) {
    if (Object.isFrozen(obj)) return obj;

    var keys = Object.keys(obj);
    for (idx = 0; idx < keys.length; idx++) {
      var key = keys[idx];
      obj[key] = util.freeze(obj[key]);
    }
    return Object.freeze(obj);
  } else if (_.isArray(obj)) {
    var arr = obj;
    for (idx = 0; idx < arr.length; idx++) {
      arr[idx] = util.freeze(arr[idx]);
    }
    return Object.freeze(arr);
  } else {
    return obj; // Object.freeze(obj);
  }
};

util.later = function(f, context) {
  return function() {
    var _args = arguments;
    window.setTimeout(function() {
      f.apply(context, _args);
    }, 0);
  };
};


// Returns true if a string doesn't contain any real content

util.isEmpty = function(str) {
  return !str.match(/\w/);
};

// Create a human readable, but URL-compatible slug from a string

util.slug = function(str) {
  str = str.replace(/^\s+|\s+$/g, ''); // trim
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to   = "aaaaeeeeiiiioooouuuunc------";
  for (var i=0, l=from.length ; i<l ; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
};


util.getReadableFileSizeString = function(fileSizeInBytes) {

    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
};

// Export
// ====

module.exports = util;

},{"fs":2,"underscore":198}],198:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],199:[function(require,module,exports){
"use strict";

var LensConverter = require('lens/converter');

var LensArticle = require("lens/article");
var CustomNodeTypes = require("./nodes");

var CustomConverter = function(options) {
  LensConverter.call(this, options);
};

CustomConverter.Prototype = function() {

  this.test = function(xmlDoc) {
    var publisherName = xmlDoc.querySelector("publisher-name").textContent;
    return publisherName === "My Journal";
  };

  // Override document factory so we can create a customized Lens article,
  // including overridden node types
  this.createDocument = function() {
    var doc = new LensArticle({
      nodeTypes: CustomNodeTypes
    });
    return doc;
  };

  // Resolve figure urls
  // --------
  // 

  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    node.url = this.resolveURL(state, url);
  };


  // Example url to JPG: http://cdn.elifesciences.org/elife-articles/00768/svg/elife00768f001.jpg
  this.resolveURL = function(state, url) {
    // Use absolute URL
    if (url.match(/http:\/\//)) return url;

    // Look up base url
    var baseURL = this.getBaseURL(state);

    if (baseURL) {
      return [baseURL, url].join('');
    } else {
      // Use special URL resolving for production articles
      return [
        "http://cdn.elifesciences.org/elife-articles/",
        state.doc.id,
        "/jpg/",
        url,
        ".jpg"
      ].join('');
    }
  };
  /*
  this.enhanceVideo = function(state, node, element) {
    var href = element.getAttribute("xlink:href").split(".");
    var name = href[0];
    node.url = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file/"+name+".mp4";
    node.url_ogv = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file//"+name+".ogv";
    node.url_webm = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file//"+name+".webm";
    node.poster = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file/"+name+".jpg";
  };*/
};

CustomConverter.Prototype.prototype = LensConverter.prototype;
CustomConverter.prototype = new CustomConverter.Prototype();
CustomConverter.prototype.constructor = CustomConverter;

module.exports = CustomConverter;

},{"./nodes":200,"lens/article":5,"lens/converter":142}],200:[function(require,module,exports){
module.exports = {
  //"cover": require("./cover")
  //"raptor": require("./raptor")
};
},{}],201:[function(require,module,exports){
"use strict";

var Lens = require("lens/reader");
var panels = Lens.getDefaultPanels();
  
// All available converters
var LensConverter = require("lens/converter");
var CustomConverter = require("./custom_converter");
//var ElifeConverter = require("lens/converter/elife_converter");

// Custom Panels
// -------------------
// 
// The following lines enable the altmetrics panel
// which can be considered a demo implementation for a custom
// panel in Lens
// 
// Find the code in panels/altmetrics and use it as an inspiration
// to build your own Lens panel

//var altmetricsPanel = require('./panels/altmetrics');

// Insert altmetrics panel at next to last position
//panels.splice(-1, 0, altmetricsPanel);

var LensApp = function(config) {
  Lens.call(this, config);
};

LensApp.Prototype = function() {

  // Custom converters
  // ------------
  // 
  // Provides a sequence of converter instances
  // Converter.match will be called on each instance with the
  // XML document to processed. The one that returns true first
  // will be chosen. You can change the order prioritize
  // converters over others

  this.getConverters = function(converterOptions) {
    return [
      //new CustomConverter(converterOptions),
      //new ElifeConverter(converterOptions),
      new LensConverter(converterOptions)
    ]
  };

  // Custom panels
  // --------------
  // 

  this.getPanels = function() {
    return panels.slice(0);
  };
};

LensApp.Prototype.prototype = Lens.prototype;
LensApp.prototype = new LensApp.Prototype();
LensApp.prototype.constructor = LensApp;

module.exports = LensApp;
},{"./custom_converter":199,"lens/converter":142,"lens/reader":146}]},{},[1]);
