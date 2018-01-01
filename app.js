var app = angular.module('dorset-hist',[]);

var debug;
var sample_burial;

app.controller('MainController', MainController);
MainController.$inject = ['$scope','$document','$timeout','$http','$window'];

function MainController($scope, $document, $timeout, $http, $window){
	var ctrl = {
		pristine: true,
		fillerString: 'N/A'
	},
		airtableURL = 'https://api.airtable.com/v0/appNsWZDs0QYxKcdb';

	ctrl.airtable = function(url,callback){
		ctrl.loading = true;	
		ctrl.pristine = false;
		$http({
		method:'GET',
		url: url
		}).then(function(res){
			callback(res.data);
			ctrl.loading = false;
			ctrl.updateMap();
		});
	};

	ctrl.queryBurialsURL = function(name){
		return `${airtableURL}/Burials?
		filterByFormula=(FIND(LOWER(%22${name}%22)%2CLOWER(Name))${ctrl.searchFirstName?'':'%3D1'})
		&sort%5B0%5D%5Bfield%5D=Name
		&sort%5B0%5D%5Bdirection%5D=asc
		&sort%5B1%5D%5Bfield%5D=Year
		&sort%5B1%5D%5Bdirection%5D=asc`;
	};

	ctrl.createLotURLFromLotName = function(lotname){
		return `${airtableURL}/Lots?
		filterByFormula=FIND(%22${encodeURI(lotname)}%22%2CLocation)`;
	};

	ctrl.createBurialURL = function(key){
		return `${airtableURL}/Burials/${key}`;
	};

	ctrl.readURL = function(loc){
		if(loc.search.substring(1)){
			var data = angular.fromJson(decodeURI(loc.search.substring(1)))
			ctrl.lot = data.lot;
			ctrl.burial = data.burial;
			ctrl.view = 'search';
			if(ctrl.lot!=""&&ctrl.lot){
				ctrl.view = 'lot'
			} else if(ctrl.burial!=""&&ctrl.burial) {
				ctrl.view = 'burial'
				console.log('read to disp burial')
			}
			console.log('decoded: ',data)
		} else {
			ctrl.burial = "";
			ctrl.lot = "";
			ctrl.view = "search";
			ctrl.query = "";
		}
	};

	ctrl.writeURL = function(){
		var data = {
			lot: ctrl.lot,
			burial: ctrl.burial
		}
		window.history.pushState({},'',window.location.pathname+"?"+encodeURI(angular.toJson(data)));
	};

	ctrl.init = function(){
	  	$http.defaults.headers.common.Authorization = 'Bearer {{api_key}}';
	  	ctrl.view = 'search';
		ctrl.readURL(window.location);
		ctrl.dataset = []
		ctrl.mapslink = '';
		if(ctrl.view == 'lot'){
			ctrl.airtable(ctrl.createLotURLFromLotName(ctrl.lot),function(data){
				//pipe in extra 'true' param
				ctrl.showLotCallback(data, true);
				console.log('boot lot')
			});
		}
		if(ctrl.view == 'burial'){
			ctrl.airtable(ctrl.createBurialURL(ctrl.burial),function(data){
				//pipe in extra 'true' param
				ctrl.showBurialCallback(data, true);
				console.log('boot burial')
			});
		}
		ctrl.searchFirstName = false;
	};

	ctrl.updateTable = function(){
		ctrl.airtable(ctrl.queryBurialsURL(ctrl.query), ctrl.queryCallback);
	};

	ctrl.queryCallback = function(data, echoOff){
		if(!echoOff)ctrl.writeURL();
		ctrl.dataset = data.records;
		$document[0].title = "Maple Hill Cemetery Database";
	}

	ctrl.showLot = function(lotname){
		ctrl.airtable(createLotURLFromLotName(lotname),ctrl.showLotCallback);
	};

	ctrl.showLotCallback = function(data, echoOff){
		ctrl.lot = lotname;
		ctrl.lotData = data.records[0].fields;
		ctrl.view = 'lot';
		if(!echoOff)ctrl.writeURL();
		$document[0].title = "Maple Hill - "+lotname.contains('Lot')?'Lot':''+lotname;
	};

	ctrl.showBurial = function(key){
		ctrl.airtable(ctrl.createBurialURL(key),ctrl.showBurialCallback);
	};

	ctrl.showBurialCallback = function(data, echoOff){
		ctrl.burial = data.id;
		ctrl.burialData = data.fields;
		if(!echoOff)ctrl.writeURL();
		ctrl.view = 'burial';
		$document[0].title = "Maple Hill - "+ctrl.burialData.Name;
	};

	ctrl.updateMap = function(){
		var lotname = ctrl.burialData['Location Name'][0]||ctrl.lot,
			lat = ctrl.burialData.Latitude[0]||ctrl.lotData.LAT,
			lon = ctrl.burialData.Longitude[0]||ctrl.lotData.LON;
		ctrl.mapslink = ctrl.createMapsLink(lotname+' - '+ctrl.burialData.Name+' burial site', lat, lon);
		$scope.mapDraws.forEach(function(elm){
			elm(lat, lon);
		});
		ctrl.displayMap = true;
	}

	$window.addEventListener('popstate', function(event){
		ctrl.readURL(window.location);
		console.log(ctrl.burial);
		ctrl.airtable(ctrl.queryBurialsURL(ctrl.query),function(data){
			ctrl.dataset = data.records;
			console.log('pop')
		});

		if(ctrl.view == 'lot'){	
			ctrl.airtable(ctrl.createLotURLFromLotName(ctrl.lot),function(data){
				//pass in extra true parameter
				ctrl.showLotCallback(data, true);
				console.log('pop lot')
			});
		}

		if(ctrl.view == 'burial'){	
			ctrl.airtable(ctrl.createBurialURL(ctrl.burial),function(data){
				//pass in extra true parameter
				ctrl.showBurialCallback(data, true);
				console.log('pop burial: ',ctrl.burial);
			});
		}
	});

	ctrl.getMobileOperatingSystem = function() {
	  var userAgent = navigator.userAgent || navigator.vendor || window.opera;

	      // Windows Phone must come first because its UA also contains "Android"
	    if (/windows phone/i.test(userAgent)) {
	        return "Windows Phone";
	    }

	    if (/android/i.test(userAgent)) {
	        return "Android";
	    }

	    // iOS detection from: http://stackoverflow.com/a/9039885/177710
	    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
	        return "iOS";
	    }

	    return "unknown";
	}

	ctrl.createMapsLink = function(lotname, lat, lon){
		var uri = '';
		switch(ctrl.getMobileOperatingSystem()){
			case "Android": uri=`geo:0,0?q=${lat},${lon}(${(lotname.replace(/\s/g, '+'))})`; break;
			case "iOS": uri=`comgooglemaps://?q=${lat},${lon}(${lotname.replace(/\s/g, '+')})&center=${lat},${lon}`; break;
			default: return `https://www.google.com/maps/search/?api=1&zoom=18&query=${lat}%2C${lon}&data=!5m1!1e4`;
		}
		return uri;
	}

	ctrl.searchAgain = function(){
		ctrl.loading = true;
		window.location.href = window.location.pathname;
	}

	ctrl.init();

	return ctrl;
}

app.config([
    '$compileProvider',
    function( $compileProvider )
    {   
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|comgooglemaps|geo):/);
        // Angular before v1.2 uses $compileProvider.urlSanitizationWhitelist(...)
    }
])
.filter('trustAsResourceUrl', ['$sce', function($sce) {
    return function(val) {
        return $sce.trustAsResourceUrl(val);
    };
}])
.directive('codexMap', function(){
	// Runs during compile
	return {
		// name: '',
		// priority: 1,
		// terminal: true,
		// scope: {}, // {} = isolate, true = child, false/undefined = no change
		controller: function($scope, $element, $attrs, $transclude) {
			if(!$scope.$parent.mapDraws)$scope.$parent.mapDraws=[];
			$scope.$parent.mapDraws.push(function(lat,lon){
				var canvas = $element[0];
				if(canvas.getContext){
					canvas.width = 1482;
					canvas.height = 1060;
					$element.addClass('col-xs-12');
					var ctx = canvas.getContext('2d'),
						bg = new Image(),
						pin = new Image(),
						//x,y offset
						o_x = 198,
						o_y = 396,
						//lat,lon offset
						o_u = 43.25230717,
						o_v = -73.09379866,
						//transformation matrix
						i_hat_x = -521465.606317497,
						i_hat_y = -243375.58022089995,
						j_hat_x = 209089.73158315904,
						j_hat_y = -385852.90283663775,
						pin_w = 44,
						pin_h = 80,
						//apply matrix/shifts/adjust for pin w/h
						s_lat = lat - o_u,
						s_lon = lon - o_v,
						pin_x = i_hat_x*s_lat+j_hat_x*s_lon + o_x - pin_w/2,
						pin_y = i_hat_y*s_lat+j_hat_y*s_lon + o_y - pin_h,
						//loading counter
						images = 0;
						console.log(pin_x,pin_y);
					function drawCanvas(){
						ctx.drawImage(bg,0,0);
						ctx.drawImage(pin,pin_x,pin_y,pin_w,pin_h);
					}
					function callback(){
						images++;
						if(images==2)drawCanvas();
					}
					bg.crossOrigin="Anonymous";
					pin.crossOrigin="Anonymous";
					bg.onload = callback;
					pin.onload = callback;
					bg.src = 'map.jpg';
					pin.src = 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi.png';
				}
			});
		},
		// require: 'ngModel', // Array = multiple requires, ? = optional, ^ = check parent elements
		restrict: 'A', // E = Element, A = Attribute, C = Class, M = Comment
		// template: '',
		// templateUrl: '',
		// replace: true,
		// transclude: true,
		// compile: function(tElement, tAttrs, function transclude(function(scope, cloneLinkingFn){ return function linking(scope, elm, attrs){}})),
		link: function($scope, iElm, iAttrs, controller) {
			function dataURLtoBlob(dataurl) {
			    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
			        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
			    while(n--){
			        u8arr[n] = bstr.charCodeAt(n);
			    }
			    return new Blob([u8arr], {type:mime});
			}
			iElm.on('click', function(){
				var link = document.createElement("a"),
			     	imgData = iElm[0].toDataURL({format: 'png',
			        multiplier: 4}),
			    	strDataURI = imgData.substr(22, imgData.length),
			    	blob = dataURLtoBlob(imgData),
			    	objurl = URL.createObjectURL(blob);

			     // link.target = '_blank';

			     link.href = objurl;

			     link.click();
			});
		}
	};
});
