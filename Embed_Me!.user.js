// ==UserScript==
// @name        Embed Me! 2
// @author      eight <eight04@gmail.com>
// @homepage    https://github.com/eight04/Embed-Me#2
// @supportURL  https://github.com/eight04/Embed-Me/issues
// @compatible  firefox
// @compatible  chrome
// @compatible  opera
// @version     2.2.0
// @namespace   eight04.blogspot.com2
// @description An userscript to embed video, images from links.
// @include     https://web.skype.com/ru/
// @require     https://greasyfork.org/scripts/7212-gm-config-eight-s-version/code/GM_config%20(eight's%20version).js?version=57385
// @grant       GM_addStyle
// @grant       GM_registerMenuCommand
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @license     MIT
// ==/UserScript==

window.onerror = function(message, url, lineNumber) {
	console.log("Embed Me debug ERROR: message - " + message + " url - " + url + " lineNumber - " + lineNumber);
};

var embedMe = function(){

	"use strict";

	if (location.hash.indexOf("embed-me") >= 0) {
		return null;
	}

	var globalMods = [],
			index = {},
			config, re;

	GM_config.init("Embed Me!", {
		debug: {
			label: "Show debug info in console",
			type: "checkbox",
			default: false
		},
		simple: {
			label: "Ignore complex anchor",
			type: "checkbox",
			default: true
		},
		thumbOnly: {
			label: "Show only thumbs on for video sites",
			type: "checkbox",
			default: true
		},
		excludes: {
			label: "Excludes these urls (regexp per line)",
			type: "textarea",
			default: ""
		}
	});

	function loadConfig() {
		config = GM_config.get();
		var exclude = config.excludes.trim();

		if (config.debug) { console.log("Embed Me debug: config: " + JSON.stringify(config)); }

		re = {
			excludeUrl: exclude && new RegExp(exclude.split(/\s*\n\s*/).join("|"), "i")
		};
	}

	function addModule(modProvider) {
		var mod,
				i;

		try {
			mod = modProvider();
		} catch (e) {
			if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
		}

		if (mod.global) {
			globalMods.push(mod);
		} else {
			for (i = 0; i < mod.domains.length; i++) {
				index[mod.domains[i]] = mod;
			}
		}
	}

	function validParent(node) {
		var cache = node;
		while (node != document.documentElement) {
			if (node.INVALID || node.className.indexOf("embed-me") >= 0) {
				cache.INVALID = true;
				return false;
			}
			if (!node.parentNode) {
				return false;
			}
			if (node.VALID) {
				break;
			}
			node = node.parentNode;
		}
		cache.VALID = true;
		return true;
	}

	function valid(node) {
		if (!validParent(node)) {
			return false;
		}
		if (node.nodeName != "A" || !node.href) {
			return false;
		}
		if (config.simple && (node.childNodes.length != 1 || node.childNodes[0].nodeType != 3)) {
			return false;
		}
		if (re.excludeUrl && re.excludeUrl.test(node.href)) {
			return false;
		}
		return true;
	}

	function getPatterns(mod) {
		if (!mod.getPatterns) {
			return [];
		}
		if (!mod.patterns) {
			mod.patterns = mod.getPatterns();
		}
		return mod.patterns;
	}

	function getEmbedFunction(mod) {
		if (!mod.embedFunction) {
			mod.embedFunction = mod.getEmbedFunction();
		}
		return mod.embedFunction;
	}

	function callEmbedFunc(node, params, func) {
		var replace,
				result;

		replace = function (newNode) {
			if (!node.parentNode) {
				// The node was detached from DOM tree
				throw new Error("The node was detached from DOM tree");
			}
			newNode.classList.add("embed-me");
			node.parentNode.replaceChild(newNode, node);
		};

		params.push(node.href, node.textContent, node, replace);

		if (config.debug) { console.log("Embed Me debug " + node.textContent + " params: " + params); }

		try {
			result = func.apply(null, params);
		} catch (e) {
			if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
		}

    if (result) {
			try {
				replace(result);
			} catch (e) {
				if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
			}
		}
	}

	function embed(node) {
		if (!valid(node)) {
			return;
		}
		// Never process same element twice
		node.INVALID = true;

		var mods = [],
				mod,
				patterns,
				match,
				i,
				j;

		if (node.hostname in index) {
			mods.push(index[node.hostname]);
		}

		mods = mods.concat(globalMods);

		for (j = 0; j < mods.length; j++) {
			mod = mods[j];
			try {
				patterns = getPatterns(mod);
			} catch (e) {
				if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
			}

			for (i = 0; i < patterns.length; i++) {
				if ((match = patterns[i].exec(node.href))) {

					if (config.debug) { console.log("Embed Me debug " + mod.name+' matched: '+match); }

					try {
						callEmbedFunc(node, Array.prototype.slice.call(match, 1), getEmbedFunction(mod));
					} catch (e) {
						if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
					}
					return;
				}
			}
		}
	}

	function observeDocument(callback) {

		setTimeout(callback, 0, document.body);

		new MutationObserver(function(mutations){
			var i;
			for (i = 0; i < mutations.length; i++) {
				if (!mutations[i].addedNodes.length) {
					continue;
				}
				try {
					callback(mutations[i].target);
				} catch (e) {
					if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
				}
			}
		}).observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	function init() {
		try {
			observeDocument(function(node){
				var links = node.querySelectorAll("a[href]"),
						i;
				for (i = 0; i < links.length; i++) {
					try {
						embed(links[i]);
					} catch (e) {
						if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
					}
				}
			});
		} catch (e) {
			if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
		}
	}

	loadConfig();

	GM_registerMenuCommand("Embed Me! - Configure", GM_config.open);
	GM_config.onclose = loadConfig;

	try {
		init();
	} catch (e) {
		if (config.debug) { console.log("Embed Me debug ERROR " +  e.name + ": , message: " + e.message); }
	}

	return {
		addModule: addModule
	};
}();


embedMe.addModule(function(){
	"use strict";
	//var config = embedMe().config;
	var config = {};
	config.thumbOnly = true;
	config.debug = true;

	return {
		name: "Youtube",
		domains: [
			"www.youtube.com",
			"youtube.com",
			"youtu.be"
		],
		getPatterns: function() {
			return [
				/(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?))((?:\S+&)?(?:v=)?((?:\w|-|_){11})(?:\S+)?)/i
			];
		},
		getEmbedFunction: function() {
			return function(params, id, url, text, node, replace) {

				GM_xmlhttpRequest({
					method: "GET",
					url: "//www.youtube.com/oembed?format=json&url=" + "https://www.youtube.com/watch?v=" + id + "&" + params,
					onload: function(response) {
						var container = document.createElement("div"),
                info = document.createElement("div"),
                entry = document.createElement("div"),
								link = document.createElement("a"),
								block = {},
								hash = Date.now().toString().substr("6"),
								html;

						//if (!response || JSON.parse(response.responseText).status != "200") { throw new Error("Improper response from " + url + ", response code: " + JSON.parse(response.responseText).status); }
						if (config.debug) { console.log("Embed Me debug " + node.textContent + " got responce: " +  JSON.stringify(response)); }

						link.href = url;

						block.color = "#b53f3f";
						block.background = "#a3daf0";
						block.width = 480;
						block.height = 360;

            if (config.thumbOnly) {
							html = '<image width="' + block.width + '" height="' + block.height + '" border="0" src="' + JSON.parse(response.responseText).thumbnail_url + '" alt="' + JSON.parse(response.responseText).title + '"></image>';
						} else {
              html = JSON.parse(response.responseText).html;
						}

						container.id = "yt-" + id + "-" + hash;
						container.style = "width: " + block.width + "px; margin: 0px 0px 0px 10%; background: transparent none repeat scroll 0% 0%; border-left: 8px solid " + block.color + ";";
            info.id = "info-" + id + "-" + hash;
            info.style = "display: inline-block; width: " + block.width-8 + "px; background-color: " + block.background + "; padding: 8px 0px 4px 8px;";
            entry.id = "entry-" + id + "-" + hash;
            entry.style = "display: inline-block; max-width: " + block.width + "px; max-height: " + block.height + "px; margin: 0px 8px 0px 0px; background: transparent none repeat scroll 0% 0%;";

            info.innerHTML = "<span style='font-size: 120%; color: rgb(0, 0, 0);'>Youtube: <a href='" + link.href + "'>" + JSON.parse(response.responseText).title + "</a></span><br/><span>" + JSON.parse(response.responseText).author_name + "</span>";
						entry.innerHTML = html;

						container.appendChild(info);
            container.appendChild(entry);
						replace(container);
					}
				});
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	//var config = embedMe().config;
	var config = {};
	config.thumbOnly = true;

	return {
		name: "Coub.com",
		domains: [
			"www.coub.com",
			"coub.com"
		],
		getPatterns: function() {
			return [
				/(?:https?:\/\/)?(?:www\.)?coub\.com\/view\/([\w\d]{3,8})/i
			];
		},
		getEmbedFunction: function(){
			return function(id, url, text, node, replace) {
				GM_xmlhttpRequest({
					method: "GET",
					url: "//coub.com/api/v2/coubs/" + id,
					onload: function(response) {
						if (!response.responseText || JSON.parse(response.responseText).error) {
							return;
						}

						var container = document.createElement("div"),
                info = document.createElement("div"),
                entry = document.createElement("div"),
								link = document.createElement("a"),
								block = {},
								hash = Date.now().toString().substr("6"),
								html;

						link.href = url;

						block.color = "#a88a1f";
						block.background = "#a3daf0";

						if (config.thumbOnly) {
							block.width = 400;
							block.height = 224;
							html = '<a href="' + url + '"><image max-width="' + block.width + '" max-height="' + block.height + '" border="0" src="' + JSON.parse(response.responseText).gif_versions.big + '" alt="' + JSON.parse(response.responseText).title + '"></image></a>';
						} else {
							block.width = 480;
							block.height = 270;
              html = '<iframe src="//coub.com/embed/' + id + '?muted=false&autostart=false&originalSize=false&hideTopBar=false&startWithHD=false" allowfullscreen="true" frameborder="0" width="' + block.width + '" height="' + block.height + '"></iframe>';
						}

						container.id = "cb-" + id + "-" + hash;
						container.style = "width: " + block.width + "px; margin: 0px 0px 0px 10%; background: transparent none repeat scroll 0% 0%; border-left: 8px solid " + block.color + ";";
            info.id = "info-" + id + "-" + hash;
            info.style = "display: inline-block; width: " + block.width-8 + "px; background-color: " + block.background + "; padding: 8px 0px 4px 8px;";
            entry.id = "entry-" + id + "-" + hash;
            entry.style = "display: inline-block; width: " + block.width + "px; height: " + block.height + "px; margin: 0px 8px 0px 0px; background: transparent none repeat scroll 0% 0%;";

            info.innerHTML = "<span style='font-size: 120%; color: rgb(0, 0, 0);'>Coub: <a href='" + link.href + "'>" + JSON.parse(response.responseText).title + "</a></span><br/><span>" + JSON.parse(response.responseText).channel.title + "</span>";
						entry.innerHTML = html;

						container.appendChild(info);
						container.appendChild(entry);
						replace(container);
					}
				});
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	//var config = embedMe().config;
	var config = {};
	config.thumbOnly = true;

	return {
		name: "Vimeo",
		domains: [
			"www.vimeo.com",
			"vimeo.com"
		],
		getPatterns: function() {
			return [
				/(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com\/)(\d{8})/i
			];
		},
		getEmbedFunction: function() {
			return function(id, url, text, node, replace) {

				GM_xmlhttpRequest({
					method: "GET",
					url: "//vimeo.com/api/oembed.json?url=" + "https://www.vimeo.com/" + id,
					onload: function(response) {
						var container = document.createElement("div"),
                info = document.createElement("div"),
                entry = document.createElement("div"),
								link = document.createElement("a"),
								block = {},
								hash = Date.now().toString().substr("6"),
								html;

						link.href = url;

						block.color = "#1f82a8";
						block.background = "#a3daf0";
						block.width = 480;
						block.height = 360;

            if (config.thumbOnly) {
							html = '<image width="' + block.width + '" border="0" src="' + JSON.parse(response.responseText).thumbnail_url + '" alt="' + JSON.parse(response.responseText).title + '"></image>';
						} else {
              html = JSON.parse(response.responseText).html;
						}

						container.id = "vm-" + id + "-" + hash;
						container.style = "width: " + block.width + "px; margin: 0px 0px 0px 10%; background: transparent none repeat scroll 0% 0%; border-left: 8px solid " + block.color + ";";
            info.id = "info-" + id + "-" + hash;
            info.style = "display: inline-block; width: " + block.width-8 + "px; background-color: " + block.background + "; padding: 8px 0px 4px 8px;";
            entry.id = "entry-" + id + "-" + hash;
            entry.style = "display: inline-block; width: " + block.width + "px; margin: 0px 8px 0px 0px; background: transparent none repeat scroll 0% 0%;";

            info.innerHTML = "<span style='font-size: 120%; color: rgb(0, 0, 0);'>Vimeo: <a href='" + link.href + "'>" + JSON.parse(response.responseText).title + "</a></span><br/><span>" + JSON.parse(response.responseText).author_name + "</span>";
						entry.innerHTML = html;

						container.appendChild(info);
            container.appendChild(entry);
						replace(container);
					}
				});
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";

	//var config = embedMe().config;
	var config = {};
	config.key = '5ebe6662dfb04d9caba6a5e696bf17f4';

	if (config.debug) { console.log("Embed Me debug " + node.textContent + " got responce: " +  JSON.stringify(config)); }

	return {
		name: "Steam",
		domains: [
			"steampowered.com",
			"store.steampowered.com"
		],
		getPatterns: function() {
			return [
				/(?:https?:\/\/)?(?:www\.)?(?:store\.steampowered\.com\/app\/)(?:\d{6})(?:\S+)?/i
			];
		},
		getEmbedFunction: function() {
			return function(url, text, node, replace) {
				GM_xmlhttpRequest({
					method: "GET",
					url: "//api.embed.ly/1/oembed?key=" + config.key + "&type=rich&url=" + url,
					onload: function(response) {
						var container = document.createElement("div"),
                info = document.createElement("div"),
                entry = document.createElement("div"),
								link = document.createElement("a"),
								block = {},
								hash = Date.now().toString().substr("6");

						if (config.debug) { console.log("Embed Me debug " + node.textContent + " got responce: " +  JSON.stringify(response)); }

						link.href = url;
						block.color = "#3b1b44";
						block.background = "#a3daf0";
						block.width = 460;
						block.height = 215;

						container.id = "st-" + id + "-" + hash;
						container.style = "width: " + block.width + "px; margin: 0px 0px 0px 10%; background: transparent none repeat scroll 0% 0%; border-left: 8px solid " + block.color + ";";
            info.id = "info-" + id + "-" + hash;
            info.style = "display: inline-block; width: " + block.width-8 + "px; background-color: " + block.background + "; padding: 8px 0px 4px 8px;";
            entry.id = "entry-" + id + "-" + hash;
            entry.style = "display: inline-block; width: " + block.width + "px; margin: 0px 8px 0px 0px; background: transparent none repeat scroll 0% 0%;";

            info.innerHTML = "<span style='font-size: 120%; color: rgb(0, 0, 0);'>Steam: <a href='" + link.href + "'>" + JSON.parse(response.responseText).title + "</a></span><br/><span>" + JSON.parse(response.responseText).description + "</span>";
						entry.innerHTML = '<image width="' + block.width + '" border="0" src="' + JSON.parse(response.responseText).thumbnail_url + '" alt="' + JSON.parse(response.responseText).title + '"></image>';

						container.appendChild(info);
            container.appendChild(entry);
						replace(container);
					}
				});
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	//var config = embedMe().config;
	var config = {};
	config.debug = true;

	return {
		name: "Minus.com",
		domains: [
			"www.minus.com",
			"minus.com"
		],
		getPatterns: function() {
			return [
				/(?:https?:\/\/)?(?:www\.)?(?:minus\.com\/(?:i\/|i)?)((?:\w){12,13})/i
			];
		},
		getEmbedFunction: function() {
			return function(id, url, text, node, replace) {
				var container = document.createElement("div"),
            info = document.createElement("div"),
            entry = document.createElement("div"),
						link = document.createElement("a"),
						block = {},
						hash = Date.now().toString().substr("6"),
						image = new Image();

				link.href = link.href = "http://i.minus.com/i" + id + ".jpg";

				block.color = "#8da81f";
				block.background = "#a3daf0";

				block.width = 480;
				block.height = 480;

				container.id = "mn-" + hash;
				container.style = "width: " + block.width + "px; margin: 0px 0px 0px 10%; background: transparent none repeat scroll 0% 0%; border-left: 8px solid " + block.color + ";";
				info.id = "info-" + hash;
				info.style = "width: " + block.width + "px; background-color: " + block.background + "; padding: 8px 0px 4px 8px;";
				entry.id = "entry-" + hash;
				entry.style = "width: " + block.width + "px; margin: 0px 8px 0px 0px; background: transparent none repeat scroll 0% 0%;";
				container.appendChild(info);
				container.appendChild(entry);

				image.title = text;
				image.style = "max-width: " + block.width + "px; max-height: " + block.height + "px;";
				image.src = link.href;

				info.innerHTML = "<span style='font-size: 120%; color: rgb(0, 0, 0);'>Minus.com: </span><br/><span><a href='" + url + "'>" + decodeURIComponent(link.pathname) + "</a></span>";
				link.appendChild(image);
				entry.appendChild(link);

				replace(container);
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";

	return {
		name: "Image",
		global: true,
		getPatterns: function() {
			return [
				/^[^?#]+\.(?:jpg|png|gif|jpeg)(?:$|[?#])/i
			];
		},
		getEmbedFunction: function() {
			return function(url, text, node, replace) {
				var container = document.createElement("div"),
						info = document.createElement("div"),
						entry = document.createElement("div"),
						link = document.createElement("a"),
						block = {},
						hash = Date.now().toString().substr("6"),
						image = new Image();

				link.href = url;

				block.color = "#8da81f";
				block.background = "#a3daf0";

				block.width = 480;
				block.height = 480;

				container.id = "im-" + hash;
				container.style = "width: " + block.width + "px; margin: 0px 0px 0px 10%; background: transparent none repeat scroll 0% 0%; border-left: 8px solid " + block.color + ";";
				info.id = "info-" + hash;
				info.style = "width: " + block.width + "px; background-color: " + block.background + "; padding: 8px 0px 4px 8px;";
				entry.id = "entry-" + hash;
				entry.style = "width: " + block.width + "px; margin: 0px 8px 0px 0px; background: transparent none repeat scroll 0% 0%;";
				container.appendChild(info);
				container.appendChild(entry);

				image.title = text;
				image.style = "max-width: " + block.width + "px; max-height: " + block.height + "px;";
				image.src = link.href;

				info.innerHTML = "<span style='font-size: 120%; color: rgb(0, 0, 0);'>Image: " + link.hostname + "</span><br/><span><a href='" + link.href + "'>" + decodeURIComponent(link.pathname) + "</a></span>";
				link.appendChild(image);
				entry.appendChild(link);

				replace(container);
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	return {
		name: "Video",
		global: true,
		getPatterns: function() {
			return [
				/^[^?#]+\.(?:mp4|webm|ogv|mov)(?:$|[?#])/i
			];
		},
		getEmbedFunction: function() {
			return function (url, text, node, replace) {
				var container = document.createElement("div"),
						info = document.createElement("div"),
						entry = document.createElement("div"),
						link = document.createElement("a"),
						block = {},
						hash = Date.now().toString().substr("6"),
						video = document.createElement("video");

				link.href = url;

				block.color = "#641fa8";
				block.background = "#a3daf0";

				block.width = 480;
				block.height = 480;

				container.id = "vd-" + hash;
				container.style = "width: " + block.width + "px; margin: 0px 0px 0px 10%; background: transparent none repeat scroll 0% 0%; border-left: 8px solid " + block.color + ";";
				info.id = "info-" + hash;
				info.style = "width: " + block.width + "px; background-color: " + block.background + "; padding: 8px 0px 4px 8px;";
				entry.id = "entry-" + hash;
				entry.style = "width: " + block.width + "px; margin: 0px 8px 0px 0px; background: transparent none repeat scroll 0% 0%;";
				container.appendChild(info);
				container.appendChild(entry);

				video.controls = true;
				video.title = text;
				video.style = "max-width: " + block.width + "px; max-height: " + block.height + "px;";
				video.src = link.href;

				info.innerHTML = "<span style='font-size: 120%; color: rgb(0, 0, 0);'>Video: " + link.hostname + "</span><br/><span><a href='" + link.href + "'>" + decodeURIComponent(link.pathname) + "</a></span>";
				link.appendChild(video);
				entry.appendChild(link);

				replace(container);
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	return {
		name: "Gfycat",
		domains: ["gfycat.com"],
		getPatterns: function() {
			return [
				/gfycat\.com\/([A-Z]\w*)$/i
			];
		},
		getEmbedFunction: function() {
			return function(name, url, text, node, replace) {
				GM_xmlhttpRequest({
					method: "GET",
					url: "//gfycat.com/cajax/get/" + name,
					onload: function(response) {
						var res = JSON.parse(response.responseText);
						if (res.error) {
							return;
						}
						var video = document.createElement("video");
						video.autoplay = true;
						video.loop = true;
						video.src = res.gfyItem.mp4Url;
						video.title = text;
						replace(video);
					}
				});
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	return {
		name: "Imgur gifv",
		domains: ["i.imgur.com", "imgur.com"],
		getPatterns: function() {
			return [
				/imgur\.com\/(\w+)(\.gifv|$)/i
			];
		},
		getEmbedFunction: function() {
			GM_addStyle('.imgur-embed-iframe-pub { box-shadow: 0px 0px 5px 0px rgba(0, 0, 0, 0.10); border: 1px solid #ddd; border-radius: 2px; margin: 10px 0; width: 540px; overflow: hidden; }');

			window.addEventListener("message", function(e){
				if (e.origin.indexOf("imgur.com") < 0) {
					return;
				}

				var data = JSON.parse(e.data),
					id = data.href.match(/imgur\.com\/(\w+)\//)[1],
					css = '.imgur-embed-iframe-pub-' + id + '-' + data.context + '-540 { height: ' + data.height + 'px!important; width: 540px!important; }';

				GM_addStyle(css);
			});

			return function(id) {
				var iframe = document.createElement("iframe");
				iframe.className = "imgur-embed-iframe-pub imgur-embed-iframe-pub-" + id + "-true-540";
				iframe.scrolling = "no";
				iframe.src = "//imgur.com/" + id + "/embed?w=540&ref=" + location.href + "#embed-me";
				return iframe;
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	return {
		name: "SoundCloud",
		domains: ["soundcloud.com"],
		getPatterns: function() {
			return [
				/soundcloud\.com\/[\w-]+\/[\w-]+(?:\?|$)/i
			];
		},
		getEmbedFunction: function(){
			return function(url, text, node, replace) {
				GM_xmlhttpRequest({
					method: "GET",
					url: "//soundcloud.com/oembed?format=json&url=" + url,
					onload: function(response) {
						if (!response.responseText) {
							return;
						}
						var html = JSON.parse(response.responseText).html;
						var container = document.createElement("div");
						container.innerHTML = html;
						replace(container);
					}
				});
			};
		}
	};
});

embedMe.addModule(function(){
	"use strict";
	return {
		name: "Twitch",
		domains: ["www.twitch.tv"],
		getPatterns: function() {
			return [
				/twitch\.tv\/(\w+)\/v\/(\d+)/i
			];
		},
		getEmbedFunction: function() {
			return function (user, id) {
				var container = document.createElement("div");
				container.innerHTML = '<object bgcolor="#000000" data="http://www.twitch.tv/swflibs/TwitchPlayer.swf" height="378" id="clip_embed_player_flash" type="application/x-shockwave-flash" width="620"><param name="movie" value="http://www.twitch.tv/swflibs/TwitchPlayer.swf" /><param name="allowScriptAccess" value="always" /><param name="allowNetworking" value="all" /><param name="allowFullScreen" value="true" /><param name="flashvars" value="channel=' + user + '&amp;auto_play=false&amp;autoplay=false&amp;autostart=false&amp;start_volume=25&amp;videoId=v' + id + '" /></object><br /><a href="http://www.twitch.tv/' + user + '" style="padding:2px 0px 4px; display:block; width: 320px; font-weight:normal; font-size:10px; text-decoration:underline;">Watch live video from ' + user + ' on Twitch</a>';
				return container;
			};
		}
	};
});
