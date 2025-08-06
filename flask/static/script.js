// 初始化地圖
var map = L.map('map').setView(initial_map_center, 14); // 使用從 Flask 傳過來的中心點
//console.log("從 Flask youbike_data_js:",youbike_data_js);

// 添加 OpenStreetMap 瓦片圖層
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var originPoint = null;
var destinationPoint = null;
var routeLine = null; // 用於儲存路徑線條物件，以便後續清除
var originMarker = null;
var destinationMarker = null;

// 顯示點位資訊的元素
var originDisplay = document.getElementById('origin_display');
var destinationDisplay = document.getElementById('destination_display');
var errorMessage = document.getElementById('error_message');

// 地圖點擊事件監聽
map.on('click', function(e) {
    if (originPoint === null) {
        // 設定起點
        originPoint = { lat: e.latlng.lat, lon: e.latlng.lng };
        if (originMarker) map.removeLayer(originMarker);
        originMarker = L.circleMarker(e.latlng, { radius: 8, color: 'blue', fillColor: 'blue', fillOpacity: 0.8 }).addTo(map);
        originDisplay.innerText = `(${originPoint.lat.toFixed(6)}, ${originPoint.lon.toFixed(6)})`;
    } else if (destinationPoint === null) {
        // 設定終點
        destinationPoint = { lat: e.latlng.lat, lon: e.latlng.lng };
        if (destinationMarker) map.removeLayer(destinationMarker);
        destinationMarker = L.circleMarker(e.latlng, { radius: 8, color: 'green', fillColor: 'green', fillOpacity: 0.8 }).addTo(map);
        destinationDisplay.innerText = `(${destinationPoint.lat.toFixed(6)}, ${destinationPoint.lon.toFixed(6)})`;
    } else {
        // 如果起點和終點都已設定，則點擊會重設起點
        resetPoints();
        originPoint = { lat: e.latlng.lat, lon: e.latlng.lng };
        if (originMarker) map.removeLayer(originMarker);
        originMarker = L.circleMarker(e.latlng, { radius: 8, color: 'blue', fillColor: 'blue', fillOpacity: 0.8 }).addTo(map);
        originDisplay.innerText = `(${originPoint.lat.toFixed(6)}, ${originPoint.lon.toFixed(6)})`;
    }
    errorMessage.innerText = ''; // 清除錯誤訊息
});

function resetPoints() {
    originPoint = null;
    destinationPoint = null;
    if (originMarker) map.removeLayer(originMarker);
    if (destinationMarker) map.removeLayer(destinationMarker);
    if (routeLine) map.removeLayer(routeLine);
    originMarker = null;
    destinationMarker = null;
    routeLine = null;
    originDisplay.innerText = '未設定';
    destinationDisplay.innerText = '未設定';
    errorMessage.innerText = '';
}

function calculateAndDrawRoute() {
    if (!originPoint || !destinationPoint) {
        errorMessage.innerText = '請先設定起點和終點！';
        return;
    }

    // 清除舊的路徑線條
    if (routeLine) {
        map.removeLayer(routeLine);
    }
    errorMessage.innerText = '正在計算路徑...';

    // 發送 AJAX 請求到 Flask 後端
    $.ajax({
        url: '/calculate_route',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            origin: originPoint,
            destination: destinationPoint
        }),
        success: function(response) {
            errorMessage.innerText = ''; // 清除計算中訊息
            if (response.route_coords && response.route_coords.length > 0) {
                // 收到新的路徑座標，重新繪製線條
				//console.log("response.route_coords=",response.route_coords)
                routeLine = L.polyline(response.route_coords, {
                    color: 'red',
                    weight: 5,
                    opacity: 0.7
                }).addTo(map);

                // 自動調整地圖視窗以顯示整條路徑
                map.fitBounds(routeLine.getBounds());
            } else {
                errorMessage.innerText = '未找到路徑或路徑數據為空。';
            }
        },
        error: function(xhr, status, error) {
            errorMessage.innerText = '計算路徑失敗: ' + (xhr.responseJSON ? xhr.responseJSON.error : error);
            console.error("AJAX Error: ", xhr.responseText);
        }
    });
}

// 定義一個儲存 YouBike 標記的陣列，以便後續清除
var youbikeMarkers = [];


function updata_youbike(youbikeData) {
	 // 清除所有現有的 YouBike 標記，避免重複添加
    youbikeMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });
    youbikeMarkers = []; // 清空陣列

    if (!youbikeData || youbikeData.length === 0) {
        console.warn("YouBike 數據為空或未定義，無法添加標記。");
        return;
    }

    // 遍歷 YouBike 數據中的每個站點
    youbikeData.forEach(function(station) {
        // 假設每個站點物件有 'lat' (緯度) 和 'lng' (經度) 屬性
        // 你需要根據你的實際 JSON 結構來調整這裡的屬性名
		console.log("station:",station);
        const lat = station.latitude; // 請確認實際的緯度屬性名
        const lon = station.longitude; // 請確認實際的經度屬性名
		console.log("lat:",lat,",lon:",lon);
        // 確保經緯度存在且為數字
        if (typeof lat === 'number' && typeof lon === 'number') {
            // 構建彈出視窗的內容
            // 你可以根據 station 物件的實際屬性來構建更豐富的資訊
            let popupContent = 
			`<div style="font-family: '思源黑體', 'Source Han Sans', sans-serif; font-size: 14px;"><b>${station.sna}</b><br>`; // 站點名稱 (sna)
            //popupContent += `總停車格: ${station.quantity}<br>`; // 總停車格數 (sbi)
            popupContent += `可借車輛: ${station.available_rent_bikes}<br>`; // 可借車輛數 (bemp)
			popupContent += `車位空位: ${station.available_return_bikes}<br>`;//空位數量(available_return_bikes)
            popupContent += `該站更新時間: ${station.mday}<br>`; // 該站車輛更新時間 (mday)
			popupContent += `獲取資料時間: ${station.updateTime}	</div>`; // 獲取資料時間 (mday)
			
            // 創建一個 Leaflet Marker
            const marker = L.marker([lat, lon])
                .bindPopup(popupContent,
				{
					maxWidth:200,
					minWidth:230,
					
				})// 綁定彈出視窗
                .addTo(map); // 添加到地圖上

            // 將標記儲存到陣列中，以便管理
            youbikeMarkers.push(marker);
        } else {
            console.warn("YouBike 站點數據缺少經緯度或格式不正確:", station);
        }
    });

    console.log(`已添加 ${youbikeMarkers.length} 個 YouBike 站點標記。`);
	// 你可以在頁面載入後立即呼叫這個函數，或者透過點擊按鈕來觸發它
	// 這裡我們假設你希望點擊 "更新youbike時間" 按鈕時才顯示
	// 如果想在頁面載入時就顯示，可以將這行代碼放在函數定義之後，或在 DOMContentLoaded 事件中觸發
	// addYouBikeMarkers(youbike_data_js);
}