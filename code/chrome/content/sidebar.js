if (!dfki) {
    var dfki = {};
}
if (!dfki.FireTag) {
    dfki.FireTag = {};
}

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://FireTag/common.jsm", dfki.FireTag);
Components.utils.import("resource://FireTag/prefObserver.jsm", dfki.FireTag);
Components.utils.import("resource://FireTag/rpc.jsm", dfki.FireTag);

// Constructor
function Sidebar() {
    this.suggestedConcepts = [];
    this.annotatedConcepts = [];
    this.conversationConcepts = [];
    this.lastSelectedResources = null;
    this.currentResourcesAsPimoThings = null;
    this.stopIt = false;
    this.lastSelectedAutoCompleteIndex = -99;
    this.treeboxObject = null;

    this.annotationTree = document.getElementById("annotationTree");
//    this.treeboxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);

    let autoCompleteTextbox = document.getElementById(Sidebar.annotationSearchBoxName);
    autoCompleteTextbox.popup.addEventListener("popuphidden", this.onAutoCompletePopupHidden );
    autoCompleteTextbox.popup.addEventListener("popupshown", this.onAutoCompletePopupShown );
}

// Instance methods
Sidebar.prototype = {
    resetTree : function() {
        this.treeboxObject.rowCountChanged(this.annotatedConcepts.length + 1 + this.conversationConcepts.length + 1 + 1, -this.suggestedConcepts.length);
        this.treeboxObject.rowCountChanged(this.annotatedConcepts.length + 2, -this.conversationConcepts.length);
        this.treeboxObject.rowCountChanged(1, -this.annotatedConcepts.length);
        this.annotatedConcepts.length = 0;
        this.conversationConcepts.length = 0;
        this.suggestedConcepts.length = 0;
    },

    resetSidebar : function() {
        this.currentResourcesAsPimoThings = [];

        document.getElementById("buttonEditResourceLabel").style.visibility = "hidden";
        document.getElementById("buttonPublish").style.visibility = "hidden";
        document.getElementById("imageIsPrivate").style.visibility = "hidden";
        document.getElementById("labelResource").value = "";
        document.getElementById("labelResource").tooltipText = "";

        this.resetTree();
    },

    initTree : function() {
        let currentResources = Sidebar.getCurrentResources();
        if ((currentResources) && (currentResources.length > 0)) {
            this.getPimoResults(currentResources);
        }
    },

    initSidebar : function() {
        let resources = this.currentResourcesAsPimoThings;
        let buttonEditResourceLabel = document.getElementById("buttonEditResourceLabel");
        let buttonPublish = document.getElementById("buttonPublish");
        let imageIsPrivate  = document.getElementById("imageIsPrivate");
        let labelResource = document.getElementById("labelResource");

    //    let code=""; while(code = prompt("Enter code", code)) alert(eval(code));

        let currentSelectionCount = Sidebar.getCurrentSelectionCount();

        if (currentSelectionCount == 1) {
            if ((!resources) || (resources.length == 0)) {
                imageIsPrivate.style.visibility = "hidden";
                labelResource.value = "";
                labelResource.tooltipText = "";
                buttonEditResourceLabel.style.visibility = "hidden";
                buttonPublish.style.visibility = "hidden";
            } else {
                buttonEditResourceLabel.style.visibility = "visible";
                buttonPublish.style.visibility = "visible";
                labelResource.className = "plain";
                labelResource.value = resources[0].label;
                labelResource.tooltipText = resources[0].label;
                if (resources[0].public == true) {
                    buttonPublish.disabled = true;
                    imageIsPrivate.style.visibility = "hidden";
                }
                else {
                    buttonPublish.disabled = false;
                    imageIsPrivate.src = "chrome://FireTag/skin/private.png";
                    imageIsPrivate.style.visibility = "visible";
                }
            }
        }
        //We already check for selection count < 1 in rebuildSidebar, so it must be > 1 here
        else {
            if ((!resources) || (resources.length == 0)) {
                imageIsPrivate.style.visibility = "hidden";
                labelResource.className = "header";
                labelResource.value = "0 of " + currentSelectionCount + " messages in PIMO.";
                labelResource.tooltipText = "0 of " + currentSelectionCount + " messages in PIMO.";
                buttonEditResourceLabel.style.visibility = "hidden";
                buttonPublish.style.visibility = "hidden";
            } else {
                buttonEditResourceLabel.style.visibility = "visible";
                buttonPublish.style.visibility = "visible";
                labelResource.className = "header";
                let nrResources = resources.length;
                if (resources.length >= Sidebar.MAX_NUMBER_OF_THINGS_FOR_GROCC ) {
                    nrResources = Sidebar.MAX_NUMBER_OF_THINGS_FOR_GROCC + "+";
                }
                labelResource.value = nrResources + " of " + Sidebar.getCurrentSelectionCount() + " messages in PIMO.";
                labelResource.tooltipText = nrResources + " of " + Sidebar.getCurrentSelectionCount() + " messages in PIMO.";
                let isPublic = resources[0].public;
                let mixedStatus = false;
                for (let i = 1; i < resources.length; i++) {
                    if (resources[i].public != isPublic) {
                        mixedStatus = true;
                        break;
                    }
                }
                if (mixedStatus) {
                    imageIsPrivate.src = "chrome://FireTag/skin/private_part.png";
                    imageIsPrivate.style.visibility = "visible";
                    buttonPublish.disabled = false;
                } else {
                    if (isPublic) {
                        imageIsPrivate.style.visibility = "hidden";
                        buttonPublish.disabled = true;
                    } else {
                        imageIsPrivate.src = "chrome://FireTag/skin/private.png";
                        imageIsPrivate.style.visibility = "visible";
                        buttonPublish.disabled = false;
                    }
                }
            }
        }

        this.initTree();
    },

    rebuildTree : function() {
        this.resetTree();
        this.initTree();
    },

    rebuildSidebar : function(force) {
        if (force || this.selectedResourcesChanged()) {
            this.resetSidebar();
            if (Sidebar.inPrivateMode()) {
                return;
            }

            let selectCount = Sidebar.getCurrentSelectionCount();
            if (selectCount > 0) {
                let currentResources = Sidebar.getCurrentResources();
                this.lastSelectedResources = currentResources;
                let pimoResourceURIs = [];
                for (let i = 0; i < currentResources.length; i++) {
                    let resourceURI = Sidebar.getPimoResourceUri(currentResources[i]);
                    pimoResourceURIs.push(resourceURI);
                }
                this.lookupResources(pimoResourceURIs);
            }
        }
    },

    selectedResourcesChanged : function() {
        if ((this.lastSelectedResources) && (this.lastSelectedResources.length == Sidebar.getCurrentResources().length)) {
            for (let i = 0; i < Sidebar.getCurrentResources().length; i++) {
                if ((!this.lastSelectedResources[i]) || (Sidebar.getCurrentResources()[i] != this.lastSelectedResources[i])) {
                    return true;
                }
            }
            return false;
        }
        return true;
    },

    lookupResources : function(resourceURIs) {
        let resourceURIsSliced = resourceURIs.slice(0, Sidebar.MAX_NUMBER_OF_THINGS_FOR_GROCC);
        if (resourceURIsSliced.length > 0) {
            var json = {
                method : "PimoDataApi.getAndCollectThingsForGroundingOccurrences",
                params : [ dfki.FireTag.common.authKey, resourceURIsSliced ]
            };
            let self = this;
            var callback = function (response) {
                var result = JSON.parse(response).result;
                if ((result)) {
                    for (let i = 0; i < result.length; i++) {
                        if (result[i].res) {
                            self.currentResourcesAsPimoThings.push(result[i].res);
                        }
                    }
                }
                self.initSidebar.call(self);

            };
            dfki.FireTag.rpc.JSONRPCCall(json, callback);
        }
    },

    getOBIEResults : function(resources) {
        var obieTexts = [];
        var pimoResourceUris = [];
        var len = Math.min(resources.length, Sidebar.MAX_NUMBER_OF_RESOURCES);
        for (var i = 0; i < len; i++) {
            obieTexts.push(Sidebar.getResourceTextForOBIE(resources[i]));
            pimoResourceUris.push(Sidebar.getPimoResourceUri(resources[i]));
        }

        var json = {
            method : "ObieApi.findAndCollectEntityReferencesInTexts",
            params : [ dfki.FireTag.common.authKey, obieTexts, pimoResourceUris ]
        };

        let self = this;
        var callback = function (response) {
            let result = JSON.parse(response).result;
            if (result) {

                self.treeboxObject.rowCountChanged(self.annotatedConcepts.length + 1 + self.conversationConcepts.length + 1 + 1, -self.suggestedConcepts.length);
                self.suggestedConcepts.length = 0;

                for (let i = 0, len = result.length; i < len; i++) {
                    if (result[i].res) {
                        let currentResult = result[i].res;

                        let alreadyInAnnotated = false;
                        for (let k = 0; k < self.annotatedConcepts.length; k++) {
                            if (self.annotatedConcepts[k].uri == currentResult.uri) {
                                alreadyInAnnotated = true;
                                break;
                            }
                        }

                        if (!alreadyInAnnotated) {
                            let alreadyInConversation = false;
                            for (let m = 0; m < self.conversationConcepts.length; m++) {
                                if (self.conversationConcepts[m].uri == currentResult.uri) {
                                    alreadyInConversation = true;
                                    break;
                                }
                            }

                            if (!alreadyInConversation) {
                                Sidebar.addPimoConceptToModel(currentResult, self.suggestedConcepts);
                            }
                        }
                    }
                }
                self.treeboxObject.rowCountChanged(self.annotatedConcepts.length + 1 + self.conversationConcepts.length + 1 + 1, self.suggestedConcepts.length);
            }
        };
        dfki.FireTag.rpc.JSONRPCCall(json, callback);
    },

    getPimoResults : function(resources) {
        let resourceURIs = [];
        for (let i = 0; i < resources.length; i++) {
            resourceURIs.push(Sidebar.getPimoResourceUri(resources[i]));
        }
        let json = {
            method : "PimoAnnotationApi.getAnnotationsForDataResources",
            params : [ dfki.FireTag.common.authKey, resourceURIs ]
        };

        let self = this;
        let callback = function (response) {
            let result = JSON.parse(response).result;
            if ((result) && (result.length > 0)) {

                self.treeboxObject.rowCountChanged(1, -self.annotatedConcepts.length);
                self.annotatedConcepts.length = 0;
                for (let i = 0, len = result.length; i < len; i++) {
                    Sidebar.addPimoConceptToModel(result[i], self.annotatedConcepts);
                }
                self.treeboxObject.rowCountChanged(1, self.annotatedConcepts.length);
            }

            self.getConversationAnnotations.call(self, resources);
        };
        dfki.FireTag.rpc.JSONRPCCall(json, callback);
    },

    getConversationAnnotations : function(resources) {
/*        if (resources.length == 1) {
            if (Sidebar.prefs.getBoolPref("suggestConcepts")) {
                this.getOBIEResults(resources);
            }
            return;
        }
*/
        var resourceURIs = [];
        for (let x = 1; x < resources.length; x++) {
            if (resources[x].threadId != resources[0].threadId) {
                if (Sidebar.prefs.getBoolPref("suggestConcepts")) {
                    this.getOBIEResults(resources);
                }
                return;
            }
        }

        var msgHdr = resources[0];

        let self = this;

        var convFinderListener = {
            onItemsAdded: function _onItemsAdded(aItems, aCollection) {},
            onItemsModified: function _onItemsModified(aItems, aCollection) {},
            onItemsRemoved: function _onItemsRemoved(aItems, aCollection) {},
            onQueryCompleted: function _onQueryCompleted(conversation_coll) {
                try {
                    var messagesListener = {
                        onItemsAdded: function _onItemsAdded(aItems, aCollection) {},
                        onItemsModified: function _onItemsModified(aItems, aCollection) {},
                        onItemsRemoved: function _onItemsRemoved(aItems, aCollection) {},
                        onQueryCompleted: function _onQueryCompleted(conversation_coll) {
                            try {
                                for (let i = 0; i < conversation_coll.items.length; i++) {
                                    var currentHeader = conversation_coll.items[i].folderMessage;
                                    if (resources.indexOf(currentHeader) < 0) {
                                        resourceURIs.push(Sidebar.getPimoResourceUri(currentHeader));
                                    }
                                }

                                if (resourceURIs.length > 0) {
                                    var json = {
                                        method : "PimoAnnotationApi.getAnnotationsForDataResources",
                                        params : [ dfki.FireTag.common.authKey, resourceURIs ]
                                    };

                                    var callback = function (response) {
                                        let result = JSON.parse(response).result;
                                        if (result) {

                                            self.treeboxObject.rowCountChanged(self.annotatedConcepts.length + 2, -self.conversationConcepts.length);
                                            self.conversationConcepts.length = 0;

                                            for (let i = 0; i < result.length; i++) {
                                                var alreadyInAnnotated = false;
                                                for (let j = 0; j < self.annotatedConcepts.length; j++) {
                                                    if (self.annotatedConcepts[j].uri == result[i].uri) {
                                                        alreadyInAnnotated = true;
                                                        break;
                                                    }
                                                }
                                                if (!alreadyInAnnotated) {
                                                    Sidebar.addPimoConceptToModel(result[i], self.conversationConcepts);
                                                }
                                            }
                                            self.treeboxObject.rowCountChanged(self.annotatedConcepts.length + 2, self.conversationConcepts.length);
                                            self.treeboxObject.invalidateRow(self.annotatedConcepts.length + 1);
                                        }
                                        if (Sidebar.prefs.getBoolPref("suggestConcepts")) {
                                            self.getOBIEResults.call(self, resources);
                                        }
                                    };
                                    dfki.FireTag.rpc.JSONRPCCall(json, callback);
                                } else {
                                    if (Sidebar.prefs.getBoolPref("suggestConcepts")) {
                                        self.getOBIEResults.call(self, resources);
                                    }
                                }

                            } catch (e) { }
                        }
                    };

                    for (let h = 0; h < conversation_coll.items.length; h++) {
                        conversation_coll.items[h].conversation.getMessagesCollection(messagesListener);
                    }
                } catch (e) { }
            }
        };

        if (typeof Gloda != "undefined") {
            Gloda.getMessageCollectionForHeader(msgHdr, convFinderListener);
        } else {
            if (Sidebar.prefs.getBoolPref("suggestConcepts")) {
                self.getOBIEResults.call(self, resources);
            }
        }
    },

    treeView : {
        treebox: null,
        selection: null,
        rowCount : 0,
        setTree: function (treebox) { this.treebox = treebox; },
        getCellText : function (row, column) {
            if (column.id == "name") {
                if (row === 0) {
                    return "Annotated Concepts";
                } else if (row < dfki.FireTag.instance.annotatedConcepts.length + 1) {
                    return dfki.FireTag.instance.annotatedConcepts[row - 1].name;
                } else if (row == dfki.FireTag.instance.annotatedConcepts.length + 1) {
                    return "Conversation Concepts";
                } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                    return dfki.FireTag.instance.conversationConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 2].name;
                } else if (row == (dfki.FireTag.instance.conversationConcepts.length + 1 + dfki.FireTag.instance.annotatedConcepts.length + 1)) {
                    return "Suggested Concepts";
                } else if (row > (dfki.FireTag.instance.conversationConcepts.length + 1 + dfki.FireTag.instance.annotatedConcepts.length + 1)) {
                    return dfki.FireTag.instance.suggestedConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 1 - dfki.FireTag.instance.conversationConcepts.length - 1 - 1].name;
                }
            }
            return null;
        },
        isContainer: function (row) {
            return ((row === 0) || (row == dfki.FireTag.instance.annotatedConcepts.length + 1) || (row == dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1));
        },
        isContainerOpen : function (row) {
            if (row === 0) {
                return true;
            } else if (row < dfki.FireTag.instance.annotatedConcepts.length + 1) {
                return false;
            } else if (row == dfki.FireTag.instance.annotatedConcepts.length + 1) {
                return true;
            } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                return false;
            } else if (row == (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                return true;
            } else if (row > (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                return false;
            }
            return false;
        },
        isContainerEmpty : function (row) {
            if ((row === 0) && (dfki.FireTag.instance.annotatedConcepts.length === 0)) {
                return true;
            } else if ((row === dfki.FireTag.instance.annotatedConcepts.length + 1) && (dfki.FireTag.instance.conversationConcepts.length === 0)) {
                return true;
            } else if ((row === (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) && (dfki.FireTag.instance.suggestedConcepts.length === 0)) {
                return true;
            }
            return false;
        },
        isSeparator: function (row) { return false; },
        isSorted: function () { return false; },
        isEditable: function (row, column) { return false; },
        isSelectable : function (row, col) {
            if (col.id == "action") {
                if ((row > 0) && (row < dfki.FireTag.instance.annotatedConcepts.length + 1)) {
                    return true;
                } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                    return true;
                } else if (row > (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                    return true;
                }
            }
            return false;
        },
        getParentIndex : function (row) {
            if (row === 0) {
                return -1;
            } else if (row < dfki.FireTag.instance.annotatedConcepts.length + 1) {
                return 0;
            } else if (row == dfki.FireTag.instance.annotatedConcepts.length + 1) {
                return -1;
            } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                return dfki.FireTag.instance.annotatedConcepts.length + 1;
            } else if (row === (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                return -1;
            } else if (row > (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                return dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1;
            }
            return -1;
        },
        getLevel: function (row) {
            if ((row === 0) || (row === dfki.FireTag.instance.annotatedConcepts.length + 1) || (row === (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                return 0;
            }
            return 1;
        },
        hasNextSibling : function (row, afterIndex) {
            let thisLevel = dfki.FireTag.instance.getLevel(row);
            for (let t = afterIndex + 1; t < this.rowCount; t++) {
                let nextLevel = dfki.FireTag.instance.getLevel(t);
                if (nextLevel == thisLevel) {
                    return true;
                }
                if (nextLevel < thisLevel) {
                    break;
                }
            }
            return false;
        },
        toggleOpenState : function (row) {},
        getImageSrc: function (row, col) {
            if (col.id == "name") {
                let resource = { icon : null };
                if ((row > 0) && (row < dfki.FireTag.instance.annotatedConcepts.length + 1)) {
                    resource = dfki.FireTag.instance.annotatedConcepts[row - 1];
                } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                    resource = dfki.FireTag.instance.conversationConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 2];
                } else if (row > (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                    resource = dfki.FireTag.instance.suggestedConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 1 - dfki.FireTag.instance.conversationConcepts.length - 1 - 1];
                }
                return resource.icon;
            }

            if (col.id == "action") {
                if ((row > 0) && (row < dfki.FireTag.instance.annotatedConcepts.length + 1)) {
                    return "chrome://FireTag/skin/delete.png";
                } else if (row === (dfki.FireTag.instance.annotatedConcepts.length + 1)) {
                    if (dfki.FireTag.instance.conversationConcepts.length > 0)
                        return "chrome://FireTag/skin/addAll.png";
                } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                    return "chrome://FireTag/skin/add.png";
                } else if (row > (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                    return "chrome://FireTag/skin/add.png";
                }
                return null;
            }

            if (col.id == "isPublic") {
                if ((row > 0) && (row < dfki.FireTag.instance.annotatedConcepts.length + 1)) {
                    if (!(dfki.FireTag.instance.annotatedConcepts[row - 1].isPublic)) {
                        return "chrome://FireTag/skin/private.png";
                    }
                } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                    if (!(dfki.FireTag.instance.conversationConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 2].isPublic)) {
                        return "chrome://FireTag/skin/private.png";
                    }
                } else if (row > (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                    if (!(dfki.FireTag.instance.suggestedConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 1 - dfki.FireTag.instance.conversationConcepts.length - 1 - 1].isPublic)) {
                        return "chrome://FireTag/skin/private.png";
                    }
                }
                return null;
            }
            return null;
        },
        getProgressMode : function (idx, column) {},
        getCellValue: function (idx, column) {},
        cycleHeader : function (col) {},
        selectionChanged: function () {},
        cycleCell: function (idx, column) {},
        performAction: function (action) {},
        performActionOnCell: function (action, index, column) {},
        getRowProperties: function (idx, prop) {},
        getCellProperties: function (idx, column, prop) {},
        getColumnProperties: function (column, element, prop) {}
    },

    onAutoCompletePopupShown : function () {
        if (dfki.FireTag.instance.stopIt) {
            dfki.FireTag.instance.stopIt = false;
            return;
        }
        // TODO: Prettify!
        window.setTimeout(dfki.FireTag.instance.onAutoCompletePopupShown, 100);
        let autoCompleteTextbox = document.getElementById(Sidebar.annotationSearchBoxName);
        dfki.FireTag.instance.lastSelectedAutoCompleteIndex = autoCompleteTextbox.popup.selectedIndex;
    },

    onAutoCompletePopupHidden : function (e) {
        dfki.FireTag.instance.stopIt = true;
        e.preventDefault();
        e.stopPropagation();
    },

    onButtonEditResourceLabelClicked : function() {
        if (Sidebar.getCurrentSelectionCount() == 1) {
            let currentThing = this.currentResourcesAsPimoThings[0];
            let labelElement = document.getElementById("labelResource");
            let resourceURI = currentThing.uri;

            let currentLabelValue = labelElement.value;
            let newLabel = prompt("New Label:", currentLabelValue);
            if ((newLabel) && (newLabel.length > 0)) {
                let json = {
                    method : "PimoManipulationApi.setPrefLabel",
                    params : [ dfki.FireTag.common.authKey, resourceURI, newLabel ]
                };
                dfki.FireTag.rpc.JSONRPCCall.call(this, json);

                labelElement.value = newLabel;
                labelElement.className = "plain";
                labelElement.tooltipText = newLabel;
            }
        }
    },

    onButtonPublishResourcesClicked : function() {

        for (var i = 0; i < this.currentResourcesAsPimoThings.length; i++) {
            var currentThing = this.currentResourcesAsPimoThings[i];
            var resourceURI = currentThing.uri;
            var json = {
                method : "PimoGroupApi.setPublic",
                params : [ dfki.FireTag.common.authKey, resourceURI, true ]
            };
            dfki.FireTag.rpc.JSONRPCCall(json);
        }
        var buttonPublish = document.getElementById("buttonPublish");
        buttonPublish.disabled = true;
        var imageIsPrivate  = document.getElementById("imageIsPrivate");
        imageIsPrivate.style.visibility = "hidden";

        if (Sidebar.getCurrentSelectionCount() > 1) {
            var labelResource = document.getElementById("labelResource");
            labelResource.className = "header";
            labelResource.value = Sidebar.getCurrentSelectionCount() + " of " + Sidebar.getCurrentSelectionCount() + " messages in PIMO.";
        }
    },

    onTreeClicked : function(event) {
        var row = {}, column = {}, part = {}, json = null;
        this.treeboxObject.getCellAt(event.clientX, event.clientY, row, column, part);
        if (column.value) {
            if (column.value.id == "action") {
                row = row.value;
                var resources = Sidebar.getCurrentResources();

                if ((row > 0) && (row < this.annotatedConcepts.length + 1)) {
                    var removedItem = this.annotatedConcepts.splice(row - 1, 1)[0];
                    this.treeboxObject.rowCountChanged(row, -1);

                    var resourceURIs = [];
                    for (let i = 0; i < resources.length; i++) {
                        var resourceURI = Sidebar.getPimoResourceUri(resources[i]);
                        resourceURIs.push(resourceURI);
                    }

                    json = {
                        method : "PimoAnnotationApi.removeAnnotationForDataResources",
                        params : [ dfki.FireTag.common.authKey, resourceURIs, removedItem.uri ]
                    };
                    dfki.FireTag.rpc.JSONRPCCall(json);
                } else if (row == (this.annotatedConcepts.length + 1)) {
                    while (this.conversationConcepts.length > 0) {
                        var alreadyInPimo = (this.annotatedConcepts.length > 0);
                        this.annotatedConcepts[this.annotatedConcepts.length] = this.conversationConcepts.splice(row - this.annotatedConcepts.length - 1 - 1, 1)[0];
                        this.treeboxObject.invalidate();

                        let metadataArray = Sidebar.getResourcesMetadata(resources);

                        json = {
                            method : "PimoAnnotationApi.addAnnotationForDataResourcesWithMetadatas",
                            params : [ dfki.FireTag.common.authKey, metadataArray, this.annotatedConcepts[this.annotatedConcepts.length - 1].uri  ]
                        };
                        let self = this;
                        let callback = function(response, params) {
                            if ((!alreadyInPimo) && (self.conversationConcepts.length == 0)) {
                                self.rebuildSidebar.call(self, true);
                            }
                        };
                        dfki.FireTag.rpc.JSONRPCCall(json, callback);

                    }
                } else if ((row > this.annotatedConcepts.length + 1) && (row < (this.annotatedConcepts.length + 1 + this.conversationConcepts.length + 1))) {
                    this.annotatedConcepts[this.annotatedConcepts.length] = this.conversationConcepts.splice(row - this.annotatedConcepts.length - 1 - 1, 1)[0];
                    this.treeboxObject.invalidate();

                    let metadataArray = Sidebar.getResourcesMetadata(resources);

                    json = {
                        method : "PimoAnnotationApi.addAnnotationForDataResourcesWithMetadatas",
                        params : [ dfki.FireTag.common.authKey, metadataArray, this.annotatedConcepts[this.annotatedConcepts.length - 1].uri  ]
                    };
                    let self = this;
                    let callback = function(response) {
                        if (self.annotatedConcepts.length == 1)
                            self.rebuildSidebar.call(self, true);
                    };
                    dfki.FireTag.rpc.JSONRPCCall(json, callback);
                } else if (row > this.annotatedConcepts.length + 1 + this.conversationConcepts.length + 1) {
                    this.annotatedConcepts[this.annotatedConcepts.length] = this.suggestedConcepts.splice(row - this.annotatedConcepts.length - 1 - this.conversationConcepts.length - 1 - 1, 1)[0];
                    this.treeboxObject.invalidate();

                    let metadataArray = Sidebar.getResourcesMetadata(resources);

                    json = {
                        method : "PimoAnnotationApi.addAnnotationForDataResourcesWithMetadatas",
                        params : [ dfki.FireTag.common.authKey, metadataArray, this.annotatedConcepts[this.annotatedConcepts.length - 1].uri  ]
                    };
                    let self = this;
                    let callback = function(response) {
                        if (self.annotatedConcepts.length == 1)
                            self.rebuildSidebar.call(self, true);
                    };
                    dfki.FireTag.rpc.JSONRPCCall(json, callback);
                }

                this.annotationTree.currentIndex = -1;
                this.annotationTree.view.selection.clearSelection();
                this.annotationTree.view.selection.invalidateSelection();
            } else if (column.value.id == "name") {
                if (event.detail == 2) {
                    row = row.value;

                    var uri = null;

                    if ((row > 0) && (row < this.annotatedConcepts.length + 1)) {
                        uri = Services.io.newURI(this.annotatedConcepts[row - 1].uri, null, null);
                    } else if ((row > this.annotatedConcepts.length + 1) && (row < (this.annotatedConcepts.length + 1 + this.conversationConcepts.length + 1))) {
                        uri = Services.io.newURI(this.conversationConcepts[row - this.annotatedConcepts.length - 1 - 1].uri, null, null);
                    } else if (row > (this.annotatedConcepts.length + 1 + this.conversationConcepts.length + 1)) {
                        uri = Services.io.newURI(this.suggestedConcepts[row - this.annotatedConcepts.length - 1 - this.conversationConcepts.length - 1 - 1].uri, null, null);
                    }

                    if (uri) {
                        Sidebar.extProtService.loadUrl(uri);
                    }
                }
            }
        }
    },

    onButtonToggleTasksClicked : function() {
        Sidebar.toggleTasks();
    },

    onButtonToggleDocumentsClicked : function() {
        Sidebar.toggleDocuments();
    },

    onTreeItemTooltipShowing : function(event) {
        function getConceptTypeAtCell(row, column) {
            if ((row >= 0) && (column) && (column.id == "name")) {
                if (row < dfki.FireTag.instance.annotatedConcepts.length + 1) {
                    return dfki.FireTag.instance.annotatedConcepts[row - 1].types[0].label;
                } else if ((row > dfki.FireTag.instance.annotatedConcepts.length + 1) && (row < (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1))) {
                    return dfki.FireTag.instance.conversationConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 2].types[0].label;
                } else if (row > (dfki.FireTag.instance.annotatedConcepts.length + 1 + dfki.FireTag.instance.conversationConcepts.length + 1)) {
                    return dfki.FireTag.instance.suggestedConcepts[row - dfki.FireTag.instance.annotatedConcepts.length - 1 - dfki.FireTag.instance.conversationConcepts.length - 1 - 1].types[0].label;
                }
            }
            return null;
        }

        let tooltip = document.getElementById("treeItemTooltip");
        let row = {}, column = {}, part = {};
        dfki.FireTag.instance.treeboxObject.getCellAt(event.clientX, event.clientY, row, column, part);
        let conceptText = getConceptTypeAtCell(row.value, column.value);
        if ((conceptText) && (conceptText.length > 0)) {
            tooltip.label = conceptText;
        } else {
            event.preventDefault();
        }
    },

    onSearchboxTextEntered : function() {
        var searchString  = document.getElementById(Sidebar.annotationSearchBoxName).value;

        var resources = Sidebar.getCurrentResources();
        let metadataArray = Sidebar.getResourcesMetadata(resources);

        if (dfki.FireTag.instance.lastSelectedAutoCompleteIndex < 0) {
            var params = { inn : { name : searchString }, out : null };
            window.openDialog("chrome://FireTag/content/newThing_dialog.xul", "",
                "chrome, dialog, modal, centerscreen, resizable=yes", params).focus();
            if (params.out) {

                let self = this;

                var jsonNewThing = {
                    method : "PimoManipulationApi.createNewThing",
                    params : [ dfki.FireTag.common.authKey, searchString ]
                };

                var callbackNewThing = function (response) {
                    var newThingUri = JSON.parse(response).result;

                    var jsonAddType = {
                        method : "PimoManipulationApi.addType",
                        params : [ dfki.FireTag.common.authKey, newThingUri, params.out.type ]
                    };

                    var callbackAddType = function (response) {
                        //                    var types = [];
                        //                    var obj = { uri : params.out.type };
                        //                    types[0] = obj;
                        //                    annotatedConcepts[annotatedConcepts.length] = {
                        //                        name : searchString,
                        //                        uri : newThingUri,
                        //                        types : types,
                        //                        icon: params.out.icon
                        //                    };
                        //                    treeboxObject.rowCountChanged(annotatedConcepts.length, 1);
                        document.getElementById(Sidebar.annotationSearchBoxName).value = "";

                        var jsonAddProperty = {
                            method : "PimoAnnotationApi.addAnnotationForDataResourcesWithMetadatas",
                            params : [ dfki.FireTag.common.authKey, metadataArray, newThingUri ]
                        };
                        var callbackJsonAddProperty = function(response) {
                            self.rebuildSidebar.call(self, true);
                        };
                        dfki.FireTag.rpc.JSONRPCCall(jsonAddProperty, callbackJsonAddProperty);
                    };
                    dfki.FireTag.rpc.JSONRPCCall(jsonAddType, callbackAddType);

                };
                dfki.FireTag.rpc.JSONRPCCall(jsonNewThing, callbackNewThing);
            }
        } else {
            var autoCompleteResult = dfki.FireTag.common.autoComplete.results[dfki.FireTag.instance.lastSelectedAutoCompleteIndex];

            var isAlreadyInList = false;
            for (let i = 0; i < dfki.FireTag.instance.annotatedConcepts.length; i++) {
                if (autoCompleteResult.uri == dfki.FireTag.instance.annotatedConcepts[i].uri) {
                    isAlreadyInList = true;
                    break;
                }
            }

            if (!isAlreadyInList) {
                //            annotatedConcepts[annotatedConcepts.length] = {
                //                name : rpcResult[0].label,
                //                uri : rpcResult[0].uri,
                //                icon : rpcResult[0].iconBase64For16x16,
                //                types : rpcResult[0].types
                //            };
                //            treeboxObject.rowCountChanged(annotatedConcepts.length, 1);

                var json = {
                    method : "PimoAnnotationApi.addAnnotationForDataResourcesWithMetadatas",
                    params : [ dfki.FireTag.common.authKey, metadataArray, autoCompleteResult.uri ]
                };
                let self = this;
                var callbackAdd =  function (response) {
                    self.rebuildSidebar.call(self, true);
                };

                dfki.FireTag.rpc.JSONRPCCall(json, callbackAdd);
            }
            document.getElementById(Sidebar.annotationSearchBoxName).value = "";
            dfki.FireTag.instance.lastSelectedAutoCompleteIndex = -1;
        }
    },

    onLabelClicked : function(event) {
        if (event.detail == 2) {
            let resources = this.currentResourcesAsPimoThings;
            for (let i = 0; i < resources.length; i++) {
                Sidebar.openResourceExternal(resources[i].uri);
            }
        }
    }
};

Sidebar.testConceptIsOfType = function( concept, typeUri ) {
    for (let i = 0; i < concept.allTypes.length; i++) {
        let conceptTypeUri = concept.allTypes[i].uri;
        if (conceptTypeUri == typeUri)
        	return true;
    }
    return false;
}

// Class methods
Sidebar.addPimoConceptToModel = function(concept, model) {
    if (!Sidebar.testConceptIsOfType(concept, "pimo:core#Thing"))
    	return;
    if (Sidebar.testConceptIsOfType(concept, "pimo:core#Document") && (!Sidebar.prefs.getBoolPref("autocomplete.showDocuments")) ||
    	Sidebar.testConceptIsOfType(concept, "pimo:core#Task") && (!Sidebar.prefs.getBoolPref("autocomplete.showTasks"))) {
        return;
    }

    model.push({
        uri : concept.uri,
        name : concept.label,
        icon : concept.iconBase64For16x16,
        types : concept.types,
        isPublic : concept.public
    });
};

Sidebar.toggleTasks = function() {
    let checked = document.getElementById("toggleTasks").checked;
    Sidebar.prefs.setBoolPref("autocomplete.showTasks", checked);
};

Sidebar.toggleDocuments = function() {
    let checked = document.getElementById("toggleDocuments").checked;
    Sidebar.prefs.setBoolPref("autocomplete.showDocuments", checked);
};

Sidebar.openResourceExternal = function(resourceURI) {
    let uri = Services.io.newURI(resourceURI, null, null);
    Sidebar.extProtService.loadUrl(uri);
};

Sidebar.prefs = Services.prefs.getBranch("extensions.dfki.FireTag.");
Sidebar.extProtService = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
Sidebar.inPrivateMode = function() {
    try {
        if (PrivateBrowsingUtils) {
            //Todo: check window!
            return PrivateBrowsingUtils.isWindowPrivate(window);
        }
    } catch (e) {
        let privateB = Components.classes["@mozilla.org/privatebrowsing;1"];
        if (privateB) {
            return privateB.getService(Components.interfaces.nsIPrivateBrowsingService).privateBrowsingEnabled;
        }
    }
    return false;
};

// Class properties
// ex. Sidebar.PRODUCT = "TB";
Sidebar.MAX_NUMBER_OF_THINGS_FOR_GROCC = 20;
Sidebar.MAX_NUMBER_OF_RESOURCES = 5;

dfki.FireTag.registerPrefListener = function() {
    var myPrefListener = new dfki.FireTag.prefObserver(function (branch, name) {
        switch (name) {
            case "autocomplete.showDocuments":
                var showDocuments = Sidebar.prefs.getBoolPref("autocomplete.showDocuments");
                var buttonDocuments = document.getElementById("toggleDocuments");
                buttonDocuments.checked = showDocuments;
                if (showDocuments) {
                    buttonDocuments.image = "chrome://FireTag/skin/document.png";
                } else {
                    buttonDocuments.image = "chrome://FireTag/skin/document-disabled.png";
                }
                dfki.FireTag.instance.rebuildTree.call(dfki.FireTag.instance);
                break;
            case "autocomplete.showTasks":
                var showTasks = Sidebar.prefs.getBoolPref("autocomplete.showTasks");
                var buttonTasks = document.getElementById("toggleTasks");
                buttonTasks.checked = showTasks;
                if (showTasks) {
                    buttonTasks.image = "chrome://FireTag/skin/task.png";
                } else {
                    buttonTasks.image = "chrome://FireTag/skin/task-disabled.png";
                }
                dfki.FireTag.instance.rebuildTree.call(dfki.FireTag.instance);
                break;
        }
    });
    myPrefListener.register(true);
};

window.addEventListener("load", function() {
    dfki.FireTag.instance = new Sidebar();
    dfki.FireTag.instance.treeView.rowCount = (dfki.FireTag.instance.conversationConcepts.length + dfki.FireTag.instance.suggestedConcepts.length + dfki.FireTag.instance.annotatedConcepts.length + 3);
    dfki.FireTag.instance.annotationTree.view = dfki.FireTag.instance.treeView;
    dfki.FireTag.instance.treeboxObject = dfki.FireTag.instance.annotationTree.boxObject;
    dfki.FireTag.registerPrefListener();
    dfki.FireTag.instance.addListeners.call(dfki.FireTag.instance);
    dfki.FireTag.instance.rebuildSidebar.call(dfki.FireTag.instance);
}, false);

function getStackDump() {
    var lines = [];
    for (var frame = Components.stack; frame; frame = frame.caller) {
        lines.push(frame.filename + " (" + frame.lineNumber + ")");
    }
    return lines.join("\n");
}