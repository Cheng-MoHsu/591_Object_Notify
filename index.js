const list_sheet_name = "list";//宣告list_sheet_name為list
const line_notify_token = "LINE NOTIFY權杖";//宣告line_notify_token為LINE NOTIFY權杖
const search_city = "城市名稱";//宣告search_city為城市名稱
const search_query = "?";//宣告search_query為爬蟲檔案

//函式「檢查租屋物件是否已存在」
function check_rent_item_no_duplicated(search_sheet, post_id) { //搜尋表格、post_id
	let list_sheet = SpreadsheetApp.getActive().getSheetByName(search_sheet);//宣告list_sheet為啟用表格搜尋，取得表格名稱
	let type_array = list_sheet.getRange("M2:M").getValues();//宣告表格為實際表格的取得內容並且取得物件價格
	for (let item_index = 0; item_index < type_array.length; item_index++) {//for迴圈設定表格搜索循環，設定item_index變數為0，作為for迴圈變數，如果item_index小於實際表格長度，item_index=item_index+1
		if (type_array[item_index][0] == post_id) {//如果實際表格內容0為post_id，則
			let price = list_sheet.getRange(`C${item_index + 2}`).getDisplayValue();//宣告價格為list_sheet的取得價格內容取得價格
			return price.toString();//回傳價格給toString函式
		}
	}
	return false;//如果租屋物件不存在於表格中則回傳Flase
}

function get_csrf_token() {
	let rent_home_url = "https://rent.591.com.tw";
	let reg_exp = new RegExp("<meta name=\"csrf-token\" content=\"([A-Za-z0-9]*)\">", "gi");
	let response = UrlFetchApp.fetch(rent_home_url);
	let csrf_token = reg_exp.exec(response)[1];
	const all_cookie = response.getAllHeaders()["Set-Cookie"];
	let cookie;//宣告cookie
	for (let i = 0; i < all_cookie.length; i++) {
		if (all_cookie[i].includes("591_new_session")) {
			cookie = all_cookie[i];
			break;
    }
 }
	return [csrf_token, cookie];
}

function get_formated_rent_info(search_sheet, rent_result) {
	const rent_result_length = rent_result.length;
	if (rent_result_length < 1) { 
		return [];
	}
	let format_rent_array = Array();
	for (let rent_index = 0; rent_index < rent_result_length; rent_index++) {
		let rent_item = rent_result[rent_index];
		Logger.log(rent_item);
		let rent_post_id = rent_item["post_id"];
		let rent_price = `${rent_item["price"]} ${rent_item["price_unit"]}`;
		let duplicated_price = check_rent_item_no_duplicated(search_sheet, rent_post_id);
		if (duplicated_price == rent_price) {
			continue;
		}
		let rent_title = rent_item["title"];
		let rent_url = `https://rent.591.com.tw/rent-detail-${rent_post_id}.html`;
		let rent_hyperlink = `=HYPERLINK("${rent_url}", "${rent_title}")`;
		let rent_section_name = rent_item["section_name"];
		let rent_area = rent_item["area"];
		let rent_location = rent_item["location"];
		let rent_floor = rent_item["floor_str"];
		let tmp_array = ["", rent_hyperlink, rent_price, "", "", "", rent_section_name+" / "+rent_location, "", rent_area, rent_floor, "", "", rent_post_id];
		format_rent_array.push(tmp_array);
		let line_message = `${rent_post_id}\n${rent_title}\n${rent_url}\n${rent_price}\n${rent_location}\n${rent_area}坪，${rent_floor}`;
		send_to_line_notify(line_message);
	}
	return format_rent_array;
}

function get_region_from_query(query) {
	let reg_exp = new RegExp(".*region=([0-9]*).*", "gi");
	let region_number = reg_exp.exec(query)[1];
	return region_number;
}

function get_rent_data() {
	const rent_result = get_rent_result();
	const rent_json = JSON.parse(rent_result);
	const rent_array = rent_json["data"]["data"];
	return rent_array;
}

function get_rent_result() {
	const rent_search_host = "https://rent.591.com.tw/home/search/rsList";
	let rent_search_url = `${rent_search_host}${search_query}`;
	const header_info = get_csrf_token();
	const csrf_token = header_info[0];
	const cookie = header_info[1];
	const search_city_url_encode = encodeURIComponent(search_city);
	let region_number = get_region_from_query(search_query);
	const header = {
		"X-CSRF-TOKEN": csrf_token,
		"Cookie": `${cookie}; urlJumpIp=${region_number}; urlJumpIpByTxt=${search_city_url_encode};`,
		'Content-Type': 'application/json'
	};
	const options = {
		"method": "get",
		"headers": header,
		"muteHttpExceptions": true
	};
	const response = UrlFetchApp.fetch(rent_search_url, options);
	return response.getContentText();
}

function main() {
	const rent_result = get_rent_data();
	const rent_info = get_formated_rent_info(list_sheet_name, rent_result);
	const rent_info_length = rent_info.length;
	if (rent_info_length == 0) { 
		return; 
	}
	let list_sheet = SpreadsheetApp.getActive().getSheetByName(list_sheet_name);
	list_sheet.insertRows(2, rent_info_length);
	let range = list_sheet.getRange(`A2:M${rent_info_length + 1}`);
	range.setValues(rent_info);
}

function send_to_line_notify(message) {
	const line_notify_url = "https://notify-api.line.me/api/notify";
	const header = {
		"Authorization": `Bearer ${line_notify_token}`,
		'Content-Type': 'application/x-www-form-urlencoded'
	};
	const payload = {
		"message": message,
		"notificationDisabled": true
	};
	const options = {
		"method": "post",
		"headers": header,
		"payload": payload,
		"muteHttpExceptions": true
	};
	UrlFetchApp.fetch(line_notify_url, options);
}
