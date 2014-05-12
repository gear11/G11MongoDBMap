/**
 * A JS file for creating declarative Google Maps bound to a REST data source.
 * 
 * Depends on the GoogleMaps API, and includes underscore and promisejs, no jQuery required. 20KB minimized. 
 */
var _ = require('../bower_components/underscore/underscore.js');
var promise = require('../bower_components/promisejs/promise.js').promise;

// Base URL for the REST service
var BASE_POINTS_URL = "/all/points/near/";

// Default map location: Sunset Beach Bar
var DEFAULT_LAT = 18.038246;
var DEFAULT_LNG = -63.120034;

// CSS class for where to insert Google Map
var MAP_CLASS_NAME = "g11-google-map";

// Initialize page on load
google.maps.event.addDomListener(window, 'load', initialize_page_map_elements);
function initialize_page_map_elements() {
	// Find all declared map elements and assign a new G11 Map to each
	_.each(document.getElementsByClassName(MAP_CLASS_NAME), function(el) {
		// Convert data-options attribute to map options
		LOG.debug("Initializing Google Map element");
		//LOG.debug(el);
		var g11map = new G11Map(el, { zoom: 12 });
		// Add a listener so that if the center of the map is moved, we fetch markers.
		google.maps.event.addListener(g11map.map, 'center_changed', function() {
			// Ignore the event if a timeout is pending
			if (g11map.timeout !== null) {
				return;
			}
			// Set a timeout to update the map
			g11map.timeout = window.setTimeout(function() {
				c = g11map.map.getCenter();
				g11map.loadMarkersFor(c.lat(), c.lng());
				g11map.timeout = null;
			}, 500);
		});
	});
}


/**
 * A wrapper for Google maps that supports loading/rendering markers.
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
 * Centers the map on the given lat/lng
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
 * Loads markers for the given lat/lng 
 */
G11Map.prototype.loadMarkersFor = function (lat, lng) {
	LOG.debug('Loading markers for ' + lat + ',' + lng);
	var self = this;
	var url = BASE_POINTS_URL + lat + "/" + lng;
	promise.get(url).then(function(error, data, xhr) {
		if (error) {
			LOG.warn('Geolocation query '+url+' returned status ' + xhr.status+': ');
			if (data) {
				LOG.warn(data);
			}
			return;
		}
		self.renderMarkerData(JSON.parse(data).points);
	});
};

/**
 * Renders the given marker data on the map, removing existing markers 
 */
G11Map.prototype.renderMarkerData = function(points) {
	LOG.debug('Received ' + points.length + ' points' );
	//LOG.debug(points);
	points = _.sortBy(points, function(p) {return p._id;}); // Sort the incoming points by ID
	var ar = added_and_removed(this.points, points, function(o, n) { return o._id.localeCompare(n._id); }); // Compare incoming with current
	var added = ar[0];
	var removed = ar[1];
	var self = this;
	// For each removed point, remove the corresponding marker
	_.each(removed, function(p) {
		self.markers[p._id].setMap(null);
		self.markers[p._id] = null;
	});
	// For each added point, add a marker
	_.each(added, function(p) {
		// Create marker
		var coord = p.loc.coordinates;
		var marker = new google.maps.Marker({
			position : new google.maps.LatLng(coord[1], coord[0]),
			map : self.map,
			title : p.title,
			icon: 'images/blue_dot.png'
		});
		self.markers[p._id] = marker;
		// Create an info box
		var infowindow = new google.maps.InfoWindow({
			content : '<a href="' + p.url + '"><h3>' + p.title + '</h3></a><p>Source: '+p.source+'</p>'
		});
		// Show info box on point click
		google.maps.event.addListener(marker, 'click', function() {
			infowindow.open(self.map, marker);
		});
	});
	
	this.points = points;
};

// Utility functions

/**
 * Simple, browser-safe logging 
 */
var LOG = (function() {
	var log = function(s) {
		if (typeof(console) != "undefined") { console.log(s); }
	};
	return {
		debug_on: true,
		debug: function(s) {
			if (this.debug_on) { log(s); }
		},
		warn: function(s) { log(s); }
	};
})();

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