const Ci = Components.interfaces;
const Cu = Components.utils;

if (!dfki) {
    var dfki = {};
}
if (!dfki.FireTag) {
    dfki.FireTag = {};
}

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const CLASS_ID = Components.ID("e64ddfd3-9775-4d18-994b-5a75f4ed3d1a");
const CLASS_NAME = "FireTag Concept Search";
const CONTRACT_ID = "@mozilla.org/autocomplete/search;1?name=firetag-concept-search";

let globalRequestCounter = 0;

// Implements nsIAutoCompleteResult
function EAAutoCompleteResult(searchString, searchResult, defaultIndex, errorDescription, results) {
    this._searchString = searchString;
    this._searchResult = searchResult;
    this._defaultIndex = defaultIndex;
    this._errorDescription = errorDescription;
    this._results = results;
}

EAAutoCompleteResult.prototype = {
    _searchString: "",
    _searchResult: 0,
    _defaultIndex: 0,
    _errorDescription: "",
    _results: [],

    /**
     * The original search string
     */
    get searchString() {
        return this._searchString;
    },

    /**
     * The result code of this result object, either: RESULT_IGNORED (invalid
     * searchString) RESULT_FAILURE (failure) RESULT_NOMATCH (no matches found)
     * RESULT_SUCCESS (matches found)
     */
    get searchResult() {
        return this._searchResult;
    },

    /**
     * Index of the default item that should be entered if none is selected
     */
    get defaultIndex() {
        return this._defaultIndex;
    },

    /**
     * A string describing the cause of a search failure
     */
    get errorDescription() {
        return this._errorDescription;
    },

    /**
     * The number of matches
     */
    get matchCount() {
        return this._results.length;
    },

    /**
     * Get the value of the result at the given index
     */
    getValueAt: function (index) {
        return this._results[index].label;
    },

    /**
     * Get the comment of the result at the given index
     */
    getCommentAt: function (index) {
        return this._results[index].uri;
    },

    /**
     * Get the style hint for the result at the given index
     */
    getStyleAt: function (index) {
//    if (!this._comments || !this._comments[index])
//      return null;  // not a category label, so no special styling
//
//    if (index === 0)
//      return "suggestfirst";  // category label on first line of results
//
//    return "suggesthint";   // category label on any other line of results
    },

    /**
     * Get the image for the result at the given index The return value is
     * expected to be an URI to the image to display
     */
    getImageAt : function (index) {
        return this._results[index].icon;
    },

    getLabelAt: function (index) {
        return this._results[index].label;
    },

    /**
     * Remove the value at the given index from the autocomplete results. If
     * removeFromDb is set to true, the value should be removed from persistent
     * storage as well.
     */
    removeValueAt: function (index, removeFromDb) {
        this._results.splice(index, 1);
    },

    QueryInterface: XPCOMUtils.generateQI([ Ci.nsIAutoCompleteResult ])
};


// Implements nsIAutoCompleteSearch
function EAAutoCompleteSearch() {
    Components.utils.import("resource://FireTag/common.jsm", dfki.FireTag);
    Components.utils.import("resource://FireTag/rpc.jsm", dfki.FireTag);
}

function testConceptIsOfType( concept, typeUri ) {
    for (let i = 0; i < concept.allTypes.length; i++) {
        let conceptTypeUri = concept.allTypes[i].uri;
        if (conceptTypeUri === typeUri)
            return true;
    }
    return false;
}



EAAutoCompleteSearch.prototype = {

    classDescription : CLASS_NAME,
    classID : CLASS_ID,
    contractID : CONTRACT_ID,

    /*
     * Search for a given string and notify a listener (either synchronously or
     * asynchronously) of the result
     *
     * @param searchString - The string to search for
     * @param searchParam - An extra parameter
     * @param previousResult - A previous result to use for faster searching
     * @param listener - A listener to notify when the search is complete
     */
    startSearch: function (searchString, searchParam, result, listener) {
        ++globalRequestCounter;
        let that = this;
        
        let maxMatches = 10;
        if (searchString.indexOf("*") >= 0 )
        	maxMatches = 0;

        let excludeTypes = [];
        if (!dfki.FireTag.common.showDocuments)
            excludeTypes.push("pimo:thing#Document");
        if (!dfki.FireTag.common.showTasks)
            excludeTypes.push("pimo:task#Task");

        let json = {
            method : "PimoTexanaApi.searchForThingsWithLabelLikeWithTypeFilter",
            params : [dfki.FireTag.common.authKey, searchString, excludeTypes, 0, maxMatches]
        };
        let callback = function (response, counter) {
            if (counter !== globalRequestCounter) {
                return;
            }
            dfki.FireTag.common.LOG("response: " + response);
            let rpcResult = JSON.parse(response).result;
            dfki.FireTag.common.autoComplete.results = [];
            for (let i = 0; i < rpcResult.length; i++) {
                dfki.FireTag.common.autoComplete.results[dfki.FireTag.common.autoComplete.results.length] = {
                    uri : rpcResult[i].uri,
                    label : rpcResult[i].label.trim(),
                    icon : rpcResult[i].iconBase64For16x16
                };
            }

            let newResult = new EAAutoCompleteResult(searchString, Ci.nsIAutoCompleteResult.RESULT_SUCCESS, 0, "", dfki.FireTag.common.autoComplete.results);
            listener.onSearchResult(that, newResult);
        };
        dfki.FireTag.rpc.JSONRPCCall(json, callback, globalRequestCounter, "texana");
    },

    /*
     * Stop an asynchronous search that is in progress
     */
    stopSearch: function () {
    },

    QueryInterface: XPCOMUtils.generateQI([ Ci.nsIAutoCompleteSearch ])
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([ EAAutoCompleteSearch ]);
