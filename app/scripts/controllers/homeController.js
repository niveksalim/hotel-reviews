'use strict';

/**
 * @ngdoc function
 * @name HotelReview.controller:HomeController
 * @description
 * # HomeController
 */
angular.module('HotelReview')
    .controller('HomeController', function($scope, ExampleService) {

        $scope.myHTML = null;
        // adjust the height depending on the platform
        $scope.mapHeight = ((ionic.Platform.isIOS()) ? window.screen.height - 180 : (ionic.Platform.isAndroid() ? window.innerHeight - 90 : window.innerHeight - 100)) + "px";

        // search for nearby hotel
        $scope.fetchNearbyHotel = function() {
          if ("geolocation" in navigator) {
              // get the current coordinates location
              navigator.geolocation.getCurrentPosition(function (position) {
                  var coords = position.coords;
                  var currentLatLong = coords.latitude + ", " + coords.longitude;
                  $scope.loc = { lat: coords.latitude, lon: coords.longitude };
                  $scope.myHTML = currentLatLong;
                  if (!$scope.$$phase) {
                    $scope.$apply("loc");
                    $scope.$apply("myHTML");
                  }
              });
              return true;
          }
          return false;
        };

        $scope.fetchNearbyHotel();
    });

// - Documentation: https://developers.google.com/maps/documentation/
angular.module('HotelReview').directive("appMap", function () {
    return {
        restrict: "E",
        replace: true,
        template: "<div></div>",
        scope: {
            center: "=",        // Center point on the map (e.g. <code>{ latitude: 10, longitude: 10 }</code>).
            markers: "=",       // Array of map markers (e.g. <code>[{ lat: 10, lon: 10, name: "hello" }]</code>).
            width: "@",         // Map width in pixels.
            height: "@",        // Map height in pixels.
            zoom: "@",          // Zoom level (one is totally zoomed out, 25 is very much zoomed in).
            mapTypeId: "@",     // Type of tile to show on the map (roadmap, satellite, hybrid, terrain).
            panControl: "@",    // Whether to show a pan control on the map.
            zoomControl: "@",   // Whether to show a zoom control on the map.
            scaleControl: "@"   // Whether to show scale control on the map.
        },
        link: function (scope, element, attrs) {
            var toResize, toCenter;
            var map;
            var currentMarkers;
            var currentLatitude = 0, currentLongitude = 0;
            var infoWindow;

            // listen to changes in scope variables and update the control
            var arr = ["width", "height", "markers", "mapTypeId", "panControl", "zoomControl", "scaleControl"];
            for (var i = 0, cnt = arr.length; i < arr.length; i++) {
                scope.$watch(arr[i], function () {
                    cnt--;
                    if (cnt <= 0) {
                        if ("geolocation" in navigator) {
                          // get the current coordinates location,
                          // then update the map
                            navigator.geolocation.getCurrentPosition(function (position) {
                                var coords = position.coords;
                                currentLatitude = coords.latitude;
                                currentLongitude = coords.longitude;
                                scope.center = coords;
                                updateControl();
                            });
                        }
                    }
                });
            }

            // update zoom and center without re-creating the map
            scope.$watch("zoom", function () {
                if (map && scope.zoom)
                    map.setZoom(scope.zoom * 1);
            });
            scope.$watch("center", function () {
                if (map && scope.center)
                    map.setCenter(getLocation(scope.center));
            });

            // update the control
            function updateControl() {

                // update size
                if (scope.width) element.width(scope.width);
                if (scope.height) element.height(scope.height);

                // get map options
                var options = {
                    center: new google.maps.LatLng(currentLatitude, currentLongitude),
                    zoom: 14,
                    types: ["lodging"]
                };
                if (scope.center) options.center = getLocation(scope.center);
                if (scope.zoom) options.zoom = scope.zoom * 1;
                if (scope.mapTypeId) options.mapTypeId = scope.mapTypeId;
                if (scope.panControl) options.panControl = scope.panControl;
                if (scope.zoomControl) options.zoomControl = scope.zoomControl;
                if (scope.scaleControl) options.scaleControl = scope.scaleControl;

                // create the map
                map = new google.maps.Map(element[0], options);

                // search nearby hotels
                searchNearbyHotels();
            }

            function searchNearbyHotels() {
              if(map){
                // initalize request
                var request = {
                  location: new google.maps.LatLng(currentLatitude, currentLongitude),
                  radius: 8047,
                  types: [
                    "lodging"
                  ]
                };

                // initialize service and infoWindow
                var service = new google.maps.places.PlacesService(map);
                infoWindow = new google.maps.InfoWindow();

                // find nearby lodging
                service.nearbySearch(request, function(result, status) {
                  // if the request is successful, place the marker
                  if(status == google.maps.places.PlacesServiceStatus.OK) {
                    for(var i = 0; i < result.length; i++) {
                      // for each request, determine where the lodging is, then place the marker
                      createMarker(result[i], service);
                    }
                  }
                });
              }
            }

            function createMarker(place, service) {
              var placeLoc = place.geometry.location;
              var marker = new google.maps.Marker({
                map: map,
                position: placeLoc
              });

              google.maps.event.addListener(marker, "click", function() {
                showContent(place, this, service);
              });
              google.maps.event.addListener(marker, 'mousedown', function(){
                  showContent(place, this, service);
              });
            }

            function showContent(place, theEvent, service) {
              // first get the details
              // format the content
              // display
              var reviews = "Reviews: No Reviews";
              service.getDetails({
                placeId: place.place_id
              }, function(thePlace, status) {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                  reviews = "Reviews: <br/>" + (thePlace.reviews.map(function(e) { return (e.author_name ? "Author: " + e.author_name + "<br/>" : "Author: <br/>") + (e.text ? "Comment: " + e.text + "<br/> ---- <br/>" : "<br/> ---- <br/>");  }).join(""));
                }
                var photos = (place.photos ? place.photos.map(function(e) { return  "<img src=\"" + e.getUrl({'maxWidth': 100, 'maxHeight': 100}) +  "\">"; }).join("") : "no photos");
                var content = place.name + "<br/>" + (place.rating ? "Rating: " + place.rating : "No rating") +
                "<br/>" + photos + "<br/>" + reviews;
                infoWindow.setContent(content);
                infoWindow.open(map, theEvent);
              });
            }

            // convert current location to Google maps location
            function getLocation(loc) {
                if (loc == null) return new google.maps.LatLng(currentLatitude, currentLongitude);
                if (angular.isString(loc)) loc = scope.$eval(loc);
                //console.log(loc.lat, loc.lon, scope.center);
                return new google.maps.LatLng(loc.lat, loc.lon);
            }
        }
    };
});
