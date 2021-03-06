function componentConstruct() {
}

Sidebar.prototype.addListeners = function() {
    let self = this;

    Sidebar.mainWin.gBrowser.addEventListener("DOMContentLoaded", function(event) { self.eventHandler.call(self, event); }, false);
    Sidebar.mainWin.gBrowser.tabContainer.addEventListener("TabSelect", function(event) { self.eventHandler.call(self, event); }, false);
    Sidebar.mainWin.document.getElementById("FireTagToggleSidebar").setAttribute("checkState", "true");
    Sidebar.mainWin.document.getElementById("FireTagToggleSidebar").setAttribute("checked", "true");

    // Remove event listeners on unload
    window.addEventListener("unload", function () {
        Sidebar.mainWin.gBrowser.removeEventListener("DOMContentLoaded", function(event) { self.eventHandler.call(self, event); }, false);
        Sidebar.mainWin.gBrowser.tabContainer.removeEventListener("TabSelect", function(event) { self.eventHandler.call(self, event); }, false);
        Sidebar.mainWin.document.getElementById("FireTagToggleSidebar").setAttribute("checkState", "false");
        Sidebar.mainWin.document.getElementById("FireTagToggleSidebar").removeAttribute("checked");

    }, false);
};

Sidebar.prototype.publish = function (resources, defer) {
    for (let i = 0, len = resources.length; i < len; i++) {
        let resourceURI = resources[i].uri;
        let json = {
            method: "PimoGroupApi.setPublic",
            params: [ dfki.FireTag.common.authKey, resourceURI, true ]
        };
        dfki.FireTag.rpc.JSONRPCCall(json);
    }
};

Sidebar.prototype.eventHandler = function(event) {
    let doc = event.originalTarget;

    if ((doc.location) && (doc.location.href !== Sidebar.mainWin.gBrowser.contentDocument.location.href)) {
        return;
    }

    let win = doc.defaultView;
    if (win) {
        if ((win !== win.top) || (win.frameElement)) {
            return;
        }
    }

    if ((doc.nodeName === "#document") || (doc.nodeName === "tab")) {
        this.enableSidebar();
        this.rebuildSidebar();
    }
};

Sidebar.prototype.isValidURL = function() {
    let url = Sidebar.mainWin.gBrowser.contentDocument.location.href;
    return ((url.indexOf("about:") !== 0) &&
        (url.indexOf("chrome:") !== 0) &&
        (url.indexOf("jar:") !== 0) &&
        (url.indexOf("resource:") !== 0) &&
        (url.indexOf("data:") !== 0) &&
        (url.indexOf("javascript:") !== 0));
};

Sidebar.STRIP_PER_RESOURCE = 10000;
Sidebar.mainWin = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
    getInterface(Components.interfaces.nsIWebNavigation).
    QueryInterface(Components.interfaces.nsIDocShellTreeItem).
    rootTreeItem.
    QueryInterface(Components.interfaces.nsIInterfaceRequestor).
    getInterface(Components.interfaces.nsIDOMWindow);

Sidebar.getCurrentResources = function() {
    return [Sidebar.mainWin.gBrowser.contentDocument];
};

Sidebar.getCurrentSelectionCount = function() {
    return 1;
};

Sidebar.getResourcesMetadata = function(resources) {
    return [{
        uri : Sidebar.getPimoResourceUri(resources[0]),
        label : Sidebar.getPimoResourceLabel(resources[0]),
        title: Sidebar.getPimoResourceLabel(resources[0]),
        type : "pimo:informationelement#Webpage"
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
    if (resource.body) {
        let body = resource.body.cloneNode(true);

        let scripts = body.getElementsByTagName("script");
        for (let i = scripts.length - 1; i >= 0; i--) {
            scripts[i].remove();
        }

        let styles = body.getElementsByTagName("style");
        for (let i = styles.length - 1; i >= 0; i--) {
            styles[i].remove();
        }

        // TODO: HACK
        //let bodyText = body.textContent.replace(/(\n|\t)/g, " ");
        //bodyText = bodyText.replace(/<(!--)?.*?(--)?>/g, " ");
        //bodyText = bodyText.replace(/\s+/g, " ");
        //bodyText = bodyText.substring(0, Sidebar.STRIP_PER_RESOURCE);
        //return bodyText;
        return body.innerHTML.replace(/(\n|\t)/g, " ");
    }
};
