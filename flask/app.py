# 載入道路圖層需要的套件
import osmnx as ox
import networkx as nx
# 網頁伺服器所需套件
from flask import Flask, render_template, request, jsonify
# 載入youbike資料需要用的套件
import os,json,requests,pandas as pd

app = Flask(__name__)

# 全局變數：儲存 OSMnx 圖形 G
# 注意：在實際應用中，您可能希望這個圖形在伺服器啟動時只載入一次，避免每次請求都重新建立。
# 這裡為了簡化範例，我們假設每次都載入，但請注意其性能開銷。
# 建議將其放在 app.before_first_request 或作為單例模式管理。
G = None
youbike_Data = []

def load_graph():
    """在 Flask 應用啟動時載入或初始化 OSMnx 圖形 G。"""
    global G
    if G is None:
        # 以一個固定點為中心載入圖形，確保所有操作都在這個圖形範圍內
        # 這裡使用一個較大的 dist 來確保涵蓋範圍
        try:
            print("正在載入 OSMnx 圖形，請稍候...")
            # 確保這裡的中心點和 dist 能覆蓋您的主要操作區域
            G = ox.graph_from_point((25.017270, 121.544710), dist=2000, network_type='all')
            G = ox.add_edge_speeds(G) # 添加預設速度
            G = ox.add_edge_travel_times(G) # 添加旅行時間作為權重選項
            print("OSMnx 圖形載入完成。")
        except Exception as e:
            print(f"載入 OSMnx 圖形時發生錯誤: {e}")
            G = None # 確保錯誤時 G 仍為 None
# 讀取youbike資料

def load_youbike():
    # # 爬蟲目標:Youbike臺北市公共自行車即時資訊
    url = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json"

    response = requests.get(url)
    global youbike_Data
    # 若請求狀態為200則輸出respinse物件內容
    if response.status_code == requests.codes.ok :
        print("取得網頁內容成功")
        print("網頁內容:")
        youbike_Data = response.json()
    else:
        print("取得網頁內容失敗")

# =============================================================================
#     with open(os.getcwd()+r"\YouBike2.0_測試檔.txt",encoding="UTF-8") as file:
#         global youbike_Data
#         youbike_Data = json.load(file)
#         print("副程式youbike_Data= ",youbike_Data)
#         print("副程式youbike_Data= ",type(youbike_Data))
# =============================================================================
        
# 在應用程式第一次請求前載入圖形
with app.app_context():
    load_graph()
    load_youbike()


@app.route('/')
def index():
    """渲染地圖頁面"""
    # 預設地圖中心點，可以是你圖形的中心點
    initial_map_center = [25.017270, 121.544710]
    # 將youbike資料存進變數傳到HTML頁面上
    global youbike_Data
    
    return render_template('index.html', map_center=initial_map_center,youbike_data_for_js=youbike_Data)

@app.route('/calculate_route', methods=['POST'])
def calculate_route():
    """
    接收前端發送的起點和終點座標，
    計算最短路徑，並返回路徑的經緯度點。
    """
    
    data = request.get_json()
    # 確保座標類型正確
    try:
        origin_lat = float(data['origin']['lat'])
        origin_lon = float(data['origin']['lon'])
        dest_lat = float(data['destination']['lat'])
        dest_lon = float(data['destination']['lon'])
    except ValueError:
        return jsonify({'error': 'Invalid coordinate format.'}), 400
    # 更新G圖層的中心位置
    print("origin=",origin_lat,origin_lon)
    print("dest=",dest_lat,dest_lon)
    # dist_var= 
    G = ox.graph_from_point(( (origin_lat+dest_lat)/2, (origin_lon+dest_lon)/2), dist=4000, network_type='all')
    print("new_G_center=",(origin_lat+dest_lat)/2,",",(origin_lon+dest_lon)/2)
    
    
    if G is None:
        return jsonify({'error': 'OSMnx graph not loaded.'}), 500
    

    try:
        # 尋找最近的圖形節點 (注意 OSMnx nearest_nodes 接受 (經度, 緯度))
        origin_node = ox.nearest_nodes(G, origin_lon, origin_lat)
        destination_node = ox.nearest_nodes(G, dest_lon, dest_lat)

        # 計算最短路徑 (這裡使用 'length' 作為權重，您也可以嘗試 'travel_time')
        route = nx.shortest_path(G, origin_node, destination_node, weight="length")

        # 提取路徑上所有節點的經緯度座標
        route_coordinates = []
        for node_id in route:
            node_data = G.nodes[node_id]
            # Folium PolyLine 通常需要 (緯度, 經度) 格式
            route_coordinates.append([node_data['y'], node_data['x']])

        return jsonify({'route_coords': route_coordinates})

    except Exception as e:
        print(f"計算路徑時發生錯誤: {e}")
        # 如果找不到路徑，可能是因為點不在網路中或網路不連通
        return jsonify({'error': f'無法計算路徑: {str(e)}。請確保所選點位於道路網中並相互連通。'}), 500

if __name__ == '__main__':
    app.run(debug=True) # debug=True 會在代碼修改後自動重載伺服器，方便開發






