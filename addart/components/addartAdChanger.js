// Main Add-Art JavaScript Component
const Ci = Components.interfaces;
const prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch).QueryInterface(
        Components.interfaces.nsIPrefBranchInternal);

var Policy = null;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

/*******************************************************************************
 * class definition
 ******************************************************************************/

// class constructor
function AddArtComponent() {
    this.wrappedJSObject = this;
}

// class definition
AddArtComponent.prototype = {
    // properties required for XPCOM registration: 
    classID : Components.ID("{741b4765-dbc0-c44e-9682-a3182f8fa1cc}"),
    contractID : "@eyebeam.org/addartadchanger;1",
    classDescription : "Banner to art converter",

    QueryInterface : XPCOMUtils.generateQI( [ Ci.nsIObserver ]),

    // add to category manager
    _xpcom_categories : [ {
        category : "profile-after-change"
    }
    ],

    // This will help to write debug messages to console
    myDump : function(aMessage) {
        // var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
        // consoleService.logStringMessage("add-art: " + aMessage);
    },
    myDumpObject : function(object,label) {
        stuff = [];
        for (s in object) {
            stuff.push(s);
        }
        stuff.sort();
        this.myDump(label+': '+stuff);
    },
    init : function() {
        this.myDump("init");
        
        let result = {};
        result.wrappedJSObject = result;
        Services.obs.notifyObservers(result, "adblockplus-require", 'contentPolicy');

        Policy = result.exports.Policy;
        
        // if everything is OK we continue 
        if (!Policy)
            return false;
        
        this.loadImgArray();

        // Installing our hook
        // does Policy.processNode exist?
        if (!Policy.processNode) {
            this.myDump("no processNode");
        }
        
        Policy.oldprocessNode = Policy.processNode;
        Policy.processNode = this.processNodeForAdBlock;

        this.setPref("extensions.adblockplus.fastcollapse",false);

        return true;
    },

    processNodeForAdBlock : function(wnd, node, contentType, location, collapse) {
        //this will be run in context of AdBlock Plus
        return Components.classes['@eyebeam.org/addartadchanger;1'].getService().wrappedJSObject.processNodeForAddArt(wnd, node, contentType, location, collapse);
    },
    
    processNodeForAddArt : function(wnd, node, contentType, location, collapse) {
        if (!Policy)
            return true;
        if (/^chrome:\//i.test(location))
            return true;

        if (!node || !node.ownerDocument || !node.tagName) {
            if (this.getPref("extensions.add-art.enableMoreAds") == false) {
                if (!node || !node.ownerDocument || !node.tagName) {
                    return Policy.oldprocessNode(wnd, node, contentType, location, collapse);
                } else {
                    return false;
                }
            } else {
                return true;
            }
        }       
        
        if (node.hasAttribute("NOAD"))
            return true;
        if (contentType == Components.interfaces.nsIContentPolicy.TYPE_STYLESHEET ||
                contentType == Components.interfaces.nsIContentPolicy.TYPE_DOCUMENT ||
                contentType > Components.interfaces.nsIContentPolicy.TYPE_SUBDOCUMENT   )
            return Policy.oldprocessNode(wnd, node, contentType, location, collapse);
        if (contentType == Components.interfaces.nsIContentPolicy.TYPE_SCRIPT &&
                node.ownerDocument.getElementsByTagName('HTML')[0] &&
                node.ownerDocument.getElementsByTagName('HTML')[0].getAttribute('inAdScript') == 'true') {
            //Here possible should be done some work with script-based ads
            return true;
        } else {
            if (Policy.oldprocessNode(wnd, node, contentType, location, collapse) == 1)
                return true;
            if (contentType == Components.interfaces.nsIContentPolicy.TYPE_SCRIPT) {
                //Here possible should be done some work with script-based ads 
                return true;
            }
        }

        try {
            // Replacing Ad Node to Node with Art
            var RNode = this.findAdNode(node,contentType);
            if(this.checkDanger(RNode)) {
                return Policy.oldprocessNode(wnd, node, contentType, location, collapse);
            }

            if (RNode.parentNode) {
                var newNode = this.transform(RNode, wnd);

                if(newNode) {
                    RNode.parentNode.replaceChild(newNode, RNode);  
                }
                else {
                    return Policy.oldprocessNode(wnd, node, contentType, location, collapse);
                }
            }
        } catch(e) {
            this.myDump("Error in: " + e.fileName +", line number: " + e.lineNumber +", " + e);
        }
        return false;
    },

    findAdNode : function(node,contentType) {
        var ad_node = node;

        while(ad_node.parentNode && 
            (ad_node.parentNode.tagName == 'A' ||
                ad_node.parentNode.tagName == 'OBJECT' ||
                ad_node.parentNode.tagName == 'IFRAME' ||
                (ad_node.hasAttribute && ad_node.hasAttribute('onclick')))){    
            ad_node = ad_node.parentNode;
        }
            
        return ad_node;
    },
    
    loadImgArray : function() {
        this.ImgArray = new Array();
        // taken from: https://en.wikipedia.org/wiki/Web_banner
        // 19 images sizes total

        // Rectangles
        this.ImgArray.push( [ 336, 280 ] ); // Large Rectangle
        this.ImgArray.push( [ 300, 250 ] ); // Medium Rectangle
        this.ImgArray.push( [ 180, 150 ] ); // Rectangle
        this.ImgArray.push( [ 300, 100 ] ); // 3:1 Rectangle
        this.ImgArray.push( [ 240, 400 ] ); // Vertical Rectangle

        // Squares
        this.ImgArray.push( [ 250, 250 ] ); // Square Pop-up

        // Banners
        this.ImgArray.push( [ 720, 300, ] ); // Pop-Under
        this.ImgArray.push( [ 728, 90, ] ); // Leaderboard
        this.ImgArray.push( [ 468, 60, ] ); // Full Banner
        this.ImgArray.push( [ 234, 60, ] ); // Half Banner
        this.ImgArray.push( [ 120, 240 ] ); // Vertical Banner

        //Buttons
        this.ImgArray.push( [ 120, 90 ] ); // Button 1
        this.ImgArray.push( [ 120, 60 ] ); // Button 2
        this.ImgArray.push( [ 88, 31 ] ); // Micro Bar
        this.ImgArray.push( [ 88, 15 ] ); // Micro Button
        this.ImgArray.push( [ 125, 125 ] ); // Square Button

        //Skyscrapers
        this.ImgArray.push( [ 120, 600 ] ); // Standard Skyscraper
        this.ImgArray.push( [ 160, 600 ] ); // Wide Skyscraper
        this.ImgArray.push( [ 300, 600 ] ); // Half-Page

    },

    askLink : function(width, height) {
        // Find this.ImgArray with minimal waste (or need - in this case it will be shown in full while mouse over it) of space
        var optimalbanners = null;
        var minDiff = Number.POSITIVE_INFINITY;
        for ( var i = 0; i < this.ImgArray.length; i++) {
            var diff = Math.abs(width / height - this.ImgArray[i][0] / this.ImgArray[i][1]);
            if (Math.abs(diff) < Math.abs(minDiff)) {
                minDiff = diff;
                optimalbanners = [ i ];
            } else if (diff == minDiff) {
                optimalbanners.push(i);
            }
        }

        var optimalBanner = [];
        minDiff = Number.POSITIVE_INFINITY;
        for (i = 0; i < optimalbanners.length; i++) {
            var diff = Math.abs(width * height - this.ImgArray[optimalbanners[i]][0] * this.ImgArray[optimalbanners[i]][1]);
            if (diff < minDiff) {
                minDiff = diff;
                optimalBanner = [ optimalbanners[i] ];
            } else if (diff == minDiff) {
                optimalBanner.push(optimalbanners[i]);
            }
        }
        return this.ImgArray[optimalBanner[Math.floor(Math.random() * optimalBanner.length)]];
    },
    checkDanger: function(element) {
        // if we try to replace elements of this kind, firefox crashes.
        return typeof(element.wrappedJSObject) == 'function';
    },

    createConteneur : function(OldElt, wnd, l, L) {
        // This replaces Ad element to element with art
        var newElt = null;

        if(this.checkDanger(OldElt)) {          
            return null;
        }
        else {
            newElt = OldElt.ownerDocument.createElement("div"); 
        }
        
        newElt.setAttribute("NOAD", "true");

        // Copying style from old to new element and doing some replacing of it 
        newElt.setAttribute("style", OldElt.getAttribute("style"));
        if (OldElt.ownerDocument.defaultView && OldElt.ownerDocument.defaultView.getComputedStyle(OldElt, null)) {
            EltStyle = OldElt.ownerDocument.defaultView.getComputedStyle(OldElt, null);
            newElt.style.position = EltStyle.getPropertyValue('position');
            if (EltStyle.getPropertyValue('display') == 'inline' || EltStyle.getPropertyValue('display') == 'inline-table')
                newElt.style.display = "inline-block";
            else
                newElt.style.display = EltStyle.getPropertyValue('display');
            newElt.style.visibility = EltStyle.getPropertyValue('visibility');
            newElt.style.zIndex = EltStyle.getPropertyValue('z-index');
            newElt.style.clip = EltStyle.getPropertyValue('clip');
            newElt.style.float = EltStyle.getPropertyValue('float');
            newElt.style.clear = EltStyle.getPropertyValue('clear');
        }

        newElt.style.background = "";
        if (OldElt.hasAttribute("id"))
            newElt.setAttribute("id", OldElt.getAttribute("id"));
        if (OldElt.hasAttribute("name"))
            newElt.setAttribute("name", OldElt.getAttribute("name"));
        if (OldElt.hasAttribute("class"))
            newElt.setAttribute("class", OldElt.getAttribute("class"));

        newElt.style.height = l + "px";
        newElt.style.width = L + "px";
        newElt.style.overflow = "hidden";
        newElt.style.cursor = "pointer";
        newElt.title = "Replaced by Add-Art";
        
        // Expanding images
        // Setting Art to be shown in full while is over it
        if (this.getPref("extensions.add-art.expandImages")) {
            newElt.setAttribute("onmouseover","this.style.overflow = 'visible';this.style.zIndex= 100000;");
            newElt.setAttribute("onmouseout","this.style.overflow = 'hidden';this.style.zIndex= 0;");
            var link = this.getPref("extensions.add-art.adLink");
            newElt.setAttribute("onclick","window.open('"+link+"','_blank');");  
        }

        var img = OldElt.ownerDocument.createElement("img");
        img.setAttribute("NOAD", "true");
        img.setAttribute("border", "0");
        var Img = this.askLink(L, l);
        this.myDump('Img:'+Img);
        
        // Select banner URL
        // use the URL in a top window to generate a number b/w 1 and 8 (to maintain some persistence)
        var win = Components.classes['@mozilla.org/appshell/window-mediator;1']
        .getService(Components.interfaces.nsIWindowMediator)
        .getMostRecentWindow('navigator:browser');
        if (win != null) {
            var el = win.document.getElementById('content');
            if (el != null) {
                var loc = el.mCurrentBrowser.contentWindow.location.href;
            }
        }
        
        //Spreads available artwork out across an hour span
        var date = new Date();
        var min = date.getMinutes();
        var eighth = 7.5; //eighth of an hour, in minutes
        for(var i=0;i<8;i++){
            var j = i+1;
            if(min <= eighth*j) {
                var imageNumber = j;
                break;
            }
        }
        
        // pick the image
        var filename = imageNumber+"artbanner"+Img[0]+"x"+Img[1]+".jpg";
        var url = "chrome://addart/skin/"+filename;
        
        img.setAttribute("src", url);

        // return newElt;
        if (Img[1] * l / Img[2] < L) {
            img.style.width = L + "px";
            img.style.marginTop = parseInt((l - Img[1] * L / Img[0]) / 2) + 'px';
        } else {
            img.style.height = l + "px";
            img.style.marginLeft = parseInt((L - Img[0] * l / Img[1]) / 2) + 'px';
        }
        newElt.appendChild(img);
        return newElt;
    },

    typeofSize : function(Str_size) {
        if (Str_size == "auto")
            return "auto";
        if (Str_size == "inherit")
            return "inherit";
        if (Str_size.indexOf('%') > -1)
            return "percentage";
        return "pixel";
    },

    getSize : function(prop, elt) {
        if (elt.ownerDocument) {
            if (elt.ownerDocument.defaultView && elt.ownerDocument.defaultView.getComputedStyle(elt, null)) {
                var wnd = elt.ownerDocument.defaultView;
                var compW = wnd.getComputedStyle(elt, null).getPropertyValue(prop);

                if (elt.parentNode) {
                    var parentcompW = wnd.getComputedStyle(elt.parentNode, null).getPropertyValue(prop);
                }
            }
        }

        if (!compW) {
            if (elt.style[prop])
                compW = elt.style[prop];
            else if (elt[prop])
                compW = elt[prop];
            else
                compW = 0;
        }

        var capital_name = {'width':'Width','height':'Height'}[prop];

        if(elt.tagName == 'A') {
            var size = 0;
            for(var i=0;i<elt.childNodes.length;i++) {
                var child = elt.childNodes[i];
                if(child.nodeType == 1) {
                    size = Math.max(size,parseInt(wnd.getComputedStyle(child, null).getPropertyValue(prop)));
                }
            };
            return size;
        }

        var x;
        if (this.typeofSize(compW) == "percentage") {
            if (this.typeofSize(parentcompW) !== "pixel")
                x = 0;
            else
                x = parseInt(parseInt(compW) * parseInt(parentcompW) / 100);
        } else if (this.typeofSize(compW) == "auto")
            x = elt['offset'+capital_name];
        else if (this.typeofSize(compW) == "inherit") {
            if (this.typeofSize(parentcompW) !== "pixel")
                x = 0;
            else
                x = parseInt(parentcompW);
        } else
            x = parseInt(compW);
        return x;
    },

    transform : function(ToReplace, wnd) {
        try {
            var Larg = this.getSize("height", ToReplace);
            var Long = this.getSize("width", ToReplace);

            if(Larg < 10 || Long < 10) {
                return null;
            }
        }
        catch(e) {
            this.myDump(e.lineNumber + ', ' + e);
        }

        var placeholder = ToReplace.ownerDocument.createElement("div");

        if (Long == 0 || Larg == 0) {
            // placeholder = ToReplace.ownerDocument.createElement("div");
            placeholder.setAttribute("NOAD", "true");
            
            if (ToReplace.hasAttribute("style"))
                placeholder.setAttribute("style", ToReplace.getAttribute("style"));
            if (placeholder.style.background)
                placeholder.style.background = "";
            var Nodes = ToReplace.childNodes;
            for ( var i = 0; i < Nodes.length; i++) {
                if (Nodes[i].nodeType == Components.interfaces.nsIContentPolicy.TYPE_OTHER)

                    placeholder.appendChild(this.transform(Nodes[i]));
            }
            if (ToReplace.hasAttribute("id"))
                placeholder.setAttribute("id", ToReplace.getAttribute("id"));
            if (ToReplace.hasAttribute("name"))
                placeholder.setAttribute("name", ToReplace.getAttribute("name"));
            if (ToReplace.hasAttribute("class"))
                placeholder.setAttribute("class", ToReplace.getAttribute("class"));
            if (ToReplace.style.display == 'none')
                placeholder.style.display = 'none';
        } else {
            placeholder = this.createConteneur(ToReplace, wnd, Larg, Long);
        }

        return placeholder;
    },
    
    getPref: function(PrefName) {
        var Type = prefs.getPrefType(PrefName);
        if(Type == prefs.PREF_BOOL)
            return prefs.getBoolPref(PrefName);
        else if (Type==prefs.PREF_STRING)
            return prefs.getCharPref(PrefName);
        else if (Type==prefs.PREF_INT)
            return prefs.getIntPref(PrefName);
    },
    
    setPref: function(PrefName, prefValue) {
        if(this.getPref(PrefName)!==prefValue) {
            var Type = prefs.getPrefType(PrefName);
            if (Type==prefs.PREF_BOOL)
                prefs.setBoolPref(PrefName, prefValue);
            else if (Type==prefs.PREF_STRING)
                prefs.setCharPref(PrefName, prefValue);
            else if (Type==prefs.PREF_INT)
                prefs.setIntPref(PrefName, prefValue);
        }
    },
    
    // nsIObserver interface implementation
    observe : function(aSubject, aTopic, aData) {
        var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
        switch (aTopic) {
        case "profile-after-change":
            // Doing initialization stuff on FireFox start
            this.init();
            break;
        }
    }
};

/**
 * XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4,
 * SeaMonkey 2.1). XPCOMUtils.generateNSGetModule was introduced in Mozilla 1.9
 * (Firefox 3.0).
 */
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory( [ AddArtComponent ]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule( [ AddArtComponent ]);