
async function getAddressCoords(address){
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.length > 0) {
        const location = data[0];
        return [location.lat,location.lon];
    }
}

/*function makeMap(lat1,lon1,lat2,lon2){
    var latm = (parseFloat(lat1) + parseFloat(lat2))/2.0;
    var lonm = (parseFloat(lon1) + parseFloat(lon2))/2.0;
    console.log("Map from "+lat1+","+lon1+" to "+lat2+","+lon2+" centered on "+latm+","+lonm);
    var map = L.map('travel-map').setView([latm, lonm], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.Routing.control({
        waypoints: [
            L.latLng(lat1, lon1), // Starting point
            L.latLng(lat2, lon2)  // Destination point
        ]
    }).addTo(map);
}*/

async function getRoutedDistance(lat1,lon1,lat2,lon2){
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;

    var result =  await fetch(url);
    var json = await result.json();
    return [json.routes[0].legs[0].distance / 1000.0,json.routes[0].legs[0].duration / 60.0];
}

let map;
async function generateMap(source, destination,clat,clon){

    const { Map } = await google.maps.importLibrary("maps");

    map = new Map(document.getElementById("map"), {
        center: { lat: clat, lng: clon },
        zoom: 8,
    });

    google.maps.event.addListenerOnce(map, 'idle', () => {
        console.log("Map fully loaded and idle");
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer();
        directionsRenderer.setMap(map);

        directionsService.route({origin:source,destination:destination,travelMode:google.maps.TravelMode.TRANSIT},(result, status) => {
            switch(status) {
                case google.maps.DirectionsStatus.OK:
                    directionsRenderer.setDirections(result);
                    map.fitBounds(result.routes[0].bounds);
                    break;
                case google.maps.DirectionsStatus.ZERO_RESULTS:
                    console.log("No transit routes found.");
                    // Fallback: try driving mode
                    directionsService.route({origin:source,                     destination:destination, 
                        travelMode: google.maps.TravelMode.DRIVING
                    }, (result, status) => {
                        if(status === "OK"){
                            directionsRenderer.setDirections(result);
                            map.fitBounds(result.routes[0].bounds);
                            console.log("Displaying map directions");
                        } else {
                            console.error("Failed to display map directions: "+status);
                        }});
                    break;
                case google.maps.DirectionsStatus.NOT_FOUND:
                    console.error("One or both locations not found.");
                    break;
                default:
                    console.error("Unexpected map error");
            }
        });
    });
    google.maps.event.addListener(map, 'error', (error) => {
        console.error('Map loading error:', error);
    });
}

export async function updateLocations(source,destination,secret){
    if(secret != ""){
        (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
            key: secret,
            v: "weekly",
            // Use the 'v' parameter to indicate the version to use (weekly, beta, alpha, etc.).
            // Add other bootstrap parameters as needed, using camel case.
      });
    }

    let coords = await getAddressCoords(source);
    document.getElementById("contact-location-coords").href = "geo:"+coords[0]+","+coords[1]+";u=1170";
    document.getElementById("contact-address-text").innerHTML = source;
    let dest_coords = await getAddressCoords(destination);

    //makeMap(coords[0],coords[1],dest_coords[0],dest_coords[1]);
    var avg_lat = (parseFloat(coords[0]) + parseFloat(dest_coords[0]))/2.0;
    var avg_lon = (parseFloat(coords[1]) + parseFloat(dest_coords[1]))/2.0;

    //TODO: verify billing details once bank account has enough to do so to try get towards displaying right
    // Once debugged as being used correctly add a restriction to the github website for API key use and only then commit
    if(secret != "")generateMap(source,destination,avg_lat,avg_lon);

    var dist_and_duration = await getRoutedDistance(coords[0],coords[1],dest_coords[0],dest_coords[1]);
    document.getElementById("distance-km").innerHTML = dist_and_duration[0].toFixed(2);
    if(dist_and_duration[1] > 60){
        document.getElementById("commute-table").classList.add("hidden");
        document.getElementById("is-relocation").classList.remove("hidden");
    } else {
        if(dist_and_duration[0] <= 6)document.getElementById("bike-commutable").innerHTML = "Yes";
        else document.getElementById("bike-commutable").innerHTML = "No";
        if(dist_and_duration[0] <= 4.5)document.getElementById("walk-commutable").innerHTML = "Yes";
        else document.getElementById("walk-commutable").innerHTML = "No";
    }


    //TODO: get distance between the two locations and update the rest of the transport section
}