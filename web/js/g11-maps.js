/**
 * A JS file for creating declarative Google Maps.
 * 
 * Depends on the GoogleMaps API, and includes underscore and promisejs, no jQuery required. 20KB min. 
 */
var _ = require('../bower_components/underscore/underscore.js');
var promise = require('../bower_components/promise.min/index.js').promise;
var MAP_CLASS_NAME = "google-map";
// Sunset Beach Bar
var DEFAULT_LAT = 18.038246;
var DEFAULT_LNG = -63.120034;

function debug(s) {
	console.log(s);
}

function warn(s) {
	console.log(s);
}


/**
 * Convert the given string to a dictionary.  Fields are in the form key1=val1;key2=val2;...
 * @param {Object} s
 */
function toDict(s) {
	d = {};
	try {
		_.each(s.split(';'), function(term) {
			var n = term.indexOf('=');
			var val = term.substring(n + 1);
			var floatVal = parseFloat(val);
			if (!isNaN(floatVal)) {
				val = floatVal;
			}
			d[term.substring(0, n)] = val;
		});

	} catch(ex) {
		warn("Invalid dictionary form: '" + s + "'");
	}
	return d;
}

/**
 *  A wrapper for Google maps.
 */
function G11Map(el, mapOptions) {
	this.mapOptions = mapOptions;
	this.map = new google.maps.Map(el, mapOptions);
	this.points = [];
	this.markers = {};
	this.timeout = null;
	// Explicit lat/lon provided
	if (mapOptions.lat && mapOptions.lon) {
		this.setCenter(mapOptions.lat, mapOptions.lon);
	// Try HTML5 geolocation
	} else if (navigator.geolocation) {
		var self = this;
		navigator.geolocation.getCurrentPosition(function(position) {
			self.setCenter(position.coords.latitude, position.coords.longitude);
		}, function() {
			self.setCenter(DEFAULT_LAT, DEFAULT_LNG);
		});
	// Browser doesn't support Geolocation
	} else {
		this.setCenter(DEFAULT_LAT, DEFAULT_LNG);
	}
}

/**
 * Centers the map on lat/lng
 */
G11Map.prototype.setCenter = function(lat, lng) {
	var nc = new google.maps.LatLng(lat, lng);
	var cc = this.map.getCenter();
	if (nc && cc && nc.lat() == cc.lat() && nc.lng() == cc.lng()) {
		return; // No update
	}
	this.map.setCenter(nc);
	
};

/**
 * Renders the given marker data on the map, removing existing markers 
 */
G11Map.prototype.renderMarkerData = function(points) {
	debug('Received ' + points.length + ' points' );
	points = _.sortBy(points, function(p) {return p.obj._id;}); // Sort the incoming points by ID
	var ar = added_and_removed(this.points, points, function(o, n) { return o.obj._id.localeCompare(n.obj._id); }); // Compare incoming with current
	var added = ar[0];
	var removed = ar[1];
	var self = this;
	_.each(removed, function(p) {
		self.markers[p.obj._id].setMap(null);
		self.markers[p.obj._id] = null;
	});
	// For each new point
	_.each(added, function(p) {
		var page = p.obj;
		// Create marker
		var coord = page.loc.coordinates;
		var marker = new google.maps.Marker({
			position : new google.maps.LatLng(coord[1], coord[0]),
			map : self.map,
			title : page.title,
			icon: 'images/blue_dot.png'
		});
		self.markers[page._id] = marker;
		// Create an info box
		var infowindow = new google.maps.InfoWindow({
			content : '<a href="' + page.url + '"><h3>' + page.title + '</h3></a><p>Distance: ' + p.dis + '</p>'
		});
		// Show info box on point click
		google.maps.event.addListener(marker, 'click', function() {
			infowindow.open(self.map, marker);
		});
	});
	
	this.points = points;
};

/**
 * Loads markers for the given lat/lng 
 */
G11Map.prototype.loadMarkersFor = function (lat, lng) {
	debug('Loading markers for ' + lat + ',' + lng);
	var self = this;
	promise.get("/near/" + lat + "/" + lng).then(function(error, data, xhr) {
		if (error) {
			warn('Error ' + xhr.status);
			return;
		}
		self.renderMarkerData(JSON.parse(data));
	}); 
};

/**
 * Accepts 2 lists and the comparison func by which they have been sorted,
 * and returns 2 lists:
 * 
 *  - The list of items that have been added
 *  - The list of items that have been removed
 */
function added_and_removed(old_list, new_list, cmp) {
	var added = [], removed = [];
	var ptro = 0, ptrn = 0;
	while (ptro < old_list.length && ptrn < new_list.length) {
		// Item is missing from new
		if (cmp(old_list[ptro], new_list[ptrn]) < 0) { 
			removed.push(old_list[ptro]);
			ptro += 1;
		// Item is newly added
		} else if (cmp(old_list[ptro], new_list[ptrn]) > 0) { 
			added.push(new_list[ptrn]);
			ptrn += 1;
		// Items match
		} else {
			ptro += 1;
			ptrn += 1;
		}
	}
	// If old list has tail, they were all removed
	if (ptro < old_list.length) {
		removed = removed.concat(old_list.slice(ptro));
	}
	// If new list has tail, they were all added
	if (ptrn < new_list.length) {
		added = added.concat(new_list.slice(ptrn));
	}
	return [ added, removed ];
}

function initialize() {
	// Find all declared map elements and assign a new G11 Map to each
	_.each(document.getElementsByClassName(MAP_CLASS_NAME), function(el) {
		// Convert data-options attribute to map options
		var mapOptions = el.getAttribute("data-options");
		if (mapOptions) {
			mapOptions = toDict(mapOptions);
		} else {
			mapOptions = {};
		}
		if (!mapOptions.zoom) {
			mapOptions.zoom = 12;
		}
		debug("Initializing Google Map element:");
		debug(el);
		var g11map = new G11Map(el, mapOptions);
		// Add a listener so that if the center 
		google.maps.event.addListener(g11map.map, 'center_changed', function() {
			if (g11map.timeout !== null) {
				return;
			}
			g11map.timeout = window.setTimeout(function() {
				c = g11map.map.getCenter();
				g11map.loadMarkersFor(c.lat(), c.lng());
				g11map.timeout = null;
			}, 500);
		});
	});
}

google.maps.event.addDomListener(window, 'load', initialize);

