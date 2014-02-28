/**
 * A JS file for creating declarative Google Maps
 */
var _ = require('../bower_components/underscore/underscore.js');
var promise = require('../bower_components/promise.min/index.js').promise;

// Note: This example requires that you consent to location sharing when
// prompted by your browser. If you see a blank space instead of the map, this
// is probably because you have denied permission for location sharing.

var MAP_CLASS_NAME = "google-map";
var DEFAULT_LAT = 60;
var DEFAULT_LNG = 105;
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
		console.log("Invalid dictionary form: '" + s + "'");
	}
	return d;
}



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

/*
G11Map.prototype.setCenter = function(lat, lng) {
	
};
*/

/**
 * Loads markers for the map, optionally centering on the given lat/lon 
 * @param {Object} lat
 * @param {Object} lng
 */
G11Map.prototype.setCenter = function(lat, lng) {
	var nc = new google.maps.LatLng(lat, lng);
	var cc = this.map.getCenter();
	if (nc && cc && nc.lat() == cc.lat() && nc.lng() == cc.lng()) {
		return; // No update
	}
	this.map.setCenter(nc);
	
};

G11Map.prototype.renderMarkerData = function(points) {
	console.log('Received ' + points.length + ' points' );
	points = _.sortBy(points, function(p) {return p.obj._id;}); // Sort the incoming points by ID
	var ar = added_and_removed(this.points, points, function(o, n) { return o.obj._id.localeCompare(n.obj._id); }); // Compare incoming with current
	var added = ar[0];
	var removed = ar[1];
	var self = this;
	// Clear markers for points no longer in data
	//console.log("Removed:");
	//console.log(removed);
	//console.log("Added:");
	//console.log(added);
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

G11Map.prototype.loadMarkersFor = function (lat, lng) {
	
	console.log('Loading markers for ' + lat + ',' + lng);
	
	var self = this;
	// $.ajax({
		// url : "/near/" + lat + "/" + lng,
		// success : function(data) {
			// self.renderMarkerData(data);
		// }
	// });
	
	promise.get("/near/" + lat + "/" + lng).then(function(error, data, xhr) {
		if (error) {
			alert('Error ' + xhr.status);
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
	//console.log(old_list);
	//console.log(new_list);
	var added = [], removed = [];
	var ptro = 0, ptrn = 0;
	while (ptro < old_list.length && ptrn < new_list.length) {
		//console.log("Comparing "+old_list[ptro]+" to "+new_list[ptrn]);
		if (cmp(old_list[ptro], new_list[ptrn]) < 0) { // Item is missing from new
			//console.log("Item removed: "+old_list[ptro]);
			removed.push(old_list[ptro]);
			ptro += 1;
		} else if (cmp(old_list[ptro], new_list[ptrn]) > 0) { // Item is newly added
			//console.log("Item added: "+new_list[ptrn]);
			added.push(new_list[ptrn]);
			ptrn += 1;
		} else {
			//console.log("Items equal: "+new_list[ptrn]);
			ptro += 1;
			ptrn += 1;
		}
	}
	if (ptro < old_list.length) {
		//console.log("Removed:");
		//console.log(old_list.slice(ptro));
		removed = removed.concat(old_list.slice(ptro)); // Removed
	}
	if (ptrn < new_list.length) {
		//console.log("Added:");
		//console.log(new_list.slice(ptrn));
		added = added.concat(new_list.slice(ptrn)); // Added
	}
	return [ added, removed ];
}

//ar = added_and_removed(["1", "22", "333", "4444", "666666"], ["22", "333", "55555", "666666", "7777777"], 'length');
//console.log(ar[0]);
//console.log(ar[1]);

function initialize() {
	_.each(document.getElementsByClassName(MAP_CLASS_NAME), function(el) {
		var mapOptions = el.getAttribute("data-options");
		if (mapOptions) {
			mapOptions = toDict(mapOptions);
		} else {
			mapOptions = {};
		}
		if (!mapOptions.zoom) {
			mapOptions.zoom = 12;
		}
		//console.log("Found Google Map element:");
		//console.log(el);
		var g11map = new G11Map(el, mapOptions);
		google.maps.event.addListener(g11map.map, 'center_changed', function() {
			if (g11map.timeout !== null) {
				return;
			}
			g11map.timeout = window.setTimeout(function() {
				c = g11map.map.getCenter();
				console.log("Center changed:");
				console.log(c);
				g11map.loadMarkersFor(c.lat(), c.lng());
				g11map.timeout = null;
			}, 500);
		});
	});
}

google.maps.event.addDomListener(window, 'load', initialize);

