// ==UserScript==
// @name        Web Skype Enhance
// @namespace   webskypeenhance_glhf
// @include     https://web.skype.com/ru/
// @version     1
// @grant       GM_addStyle
// ==/UserScript==

try {
  GM_addStyle(":root .swx .callScreen { display: none; } :root .swx a:visited { color: #008a99 !important; }");
} catch (e) {
  consle.log("ERROR" + e.name + ": " + e.message);
}
