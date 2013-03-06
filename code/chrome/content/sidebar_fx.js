Sidebar.prototype.addListeners = function() {
    var self = this;
    this.mainWin = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
        getInterface(Components.interfaces.nsIWebNavigation).
        QueryInterface(Components.interfaces.nsIDocShellTreeItem).
        rootTreeItem.
        QueryInterface(Components.interfaces.nsIInterfaceRequestor).
        getInterface(Components.interfaces.nsIDOMWindow);

    this.mainWin.gBrowser.addEventListener("DOMContentLoaded", function() { self.onPageLoad.call(self); }, false);
    this.mainWin.gBrowser.tabContainer.addEventListener("TabSelect", function() { self.rebuildSidebar.call(self); }, false);

    // Remove event listeners on unload
    window.addEventListener("unload", function () {
        self.mainWin.gBrowser.removeEventListener("DOMContentLoaded", function() { self.onPageLoad.call(self); }, false);
        self.mainWin.gBrowser.tabContainer.removeEventListener("TabSelect", function() { self.rebuildSidebar.call(self); }, false);
    }, false);
};

Sidebar.STRIP_PER_RESOURCE = 1000;
Sidebar.annotationSearchBoxName = "annotationSearchBox";

Sidebar.getCurrentResources = function() {
    return [dfki.FireTag.instance.mainWin.gBrowser.contentDocument];
};

Sidebar.getCurrentSelectionCount = function() {
    return 1;
};

Sidebar.getResourcesMetadata = function(resources) {
    return [{
        uri : Sidebar.getPimoResourceUri(resources[0]),
        label : Sidebar.getPimoResourceLabel(resources[0]),
        title: Sidebar.getPimoResourceLabel(resources[0])
    }];
};

Sidebar.getPimoResourceUri = function(resource) {
    if ((resource) && (resource.location.href)) {
        return resource.location.href;
    }
    return null;
};

Sidebar.getPimoResourceLabel = function(resource) {
    if ((resource) && (resource.title)) {
        return resource.title;
    }
    return null;
};

Sidebar.getResourceTextForOBIE = function(resource) {
    var body = resource.body;

    if (body) {
        // TODO: HACK
        body = body.textContent.replace(/\n/g, " ").replace(/\t/g, " ");
        body = body.replace(/<!--(.|\n)*?-->/ig, " ");
        body = body.replace(/<(.|\n)*?>/ig, " ");
        body = body.replace(/\s+/ig, " ");
        body = body.substring(0, Sidebar.STRIP_PER_RESOURCE);
        return body;
    }
    return "";
};

Sidebar.prototype.onPageLoad = function(event) {
    if (Sidebar.inPrivateMode) {
        resetSidebar();
        return;
    }

    var doc = event.originalTarget;
    if (doc.location.href != this.mainWin.gBrowser.contentDocument.location.href) {
        return;
    }

    var win = doc.defaultView;
    if (win != win.top) {
        return;
    }
    if (win.frameElement) {
        return;
    }
    if (doc.nodeName == "#document") {
        this.rebuildSidebar();
    }
};