const list_sheet_name = "list";
const line_notify_token = "LINE NOTIFY權杖";
const search_city = "城市名稱";
const search_query = "?";

function check_rent_item_no_duplicated(search_sheet, post_id) { 
	let list_sheet = SpreadsheetApp.getActive().getSheetByName(search_sheet);
	let type_array = list_sheet.getRange("M2:M").getValues();
	for (let item_index = 0; item_index < type_array.length; item_index++) {
		if (type_array[item_index][0] == post_id) {
			let price = list_sheet.getRange(`C${item_index + 2}`).getDisplayValue();
			return price.toString();
		}
	}
	return false;
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
	if(reg_exp.test(query) === false){
		return 1 // default is Taipei;
	  }
	  reg_exp.lastIndex = 0;
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
