var dependencies = {
  "js": [
    "scripts/libs/virtual-dom.min.js",
    "scripts/libs/jquery-3.2.0.min.js",
    "scripts/libs/jquery-ui.min.js",
    "scripts/libs/underscore-min.js",
    "scripts/basket.js",
  ],
  "css": [
    "css/jquery-ui.css",
    "css/basket.css",
  ],
};

function insertScript(url) {
  var script = document.createElement('script');
  script.setAttribute('src', url);
  document.head.appendChild(script);
}

function insertCSS(url) {
  var link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  link.setAttribute("href", url);
  document.head.appendChild(link);
}

var baseUrl = 'https://rawgit.com/tokland/almaixera-basket/master/dist/';

insertScript(baseUrl + "all.js");
insertCSS(baseUrl + "all.css");
