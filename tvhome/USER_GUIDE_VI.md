# Hướng dẫn hình nền TV Home V3.2.6 (bản thử nghiệm chưa phát hành)

## Chọn hình nền có sẵn
Trên giao diện TV Home, dùng điều khiển chọn **Cài đặt → Kho hình nền có sẵn**. Chọn một trong bốn mẫu: Cực quang trên hồ, Bình minh trên biển, Thung lũng sương tím, Sóng ánh sáng vàng-lam. Nhấn OK để áp dụng. Ảnh được đóng gói sẵn và không cần mạng Internet.

## Tải ảnh từ iPhone bằng địa chỉ IP
1. Kết nối TV và iPhone cùng một mạng Wi-Fi/LAN riêng tư.
2. Trên TV Home, chọn **Cài đặt → Quản lý và gửi ảnh nền từ iPhone → Nhận ảnh / Quét QR hoặc nhập PIN**.
3. TV hiển thị **địa chỉ IP hiện tại của TV**, mã PIN 6 chữ số và QR có hiệu lực 15 phút. Ví dụ minh họa: `http://192.168.x.x:8765/`. **Không dùng ví dụ này làm địa chỉ thật**; nhập đúng địa chỉ trên TV.
4. Trên iPhone, mở Safari, nhập địa chỉ TV hiển thị hoặc quét mã QR. Chọn ảnh, nhập đúng PIN và chạm **Gửi ảnh lên TV**.
5. Khi TV xác nhận đã nhận, chọn **Áp dụng ảnh mới**. Có thể chọn lại trong **Thư viện ảnh đã lưu trong TV** mà không cần tải lại. Hủy trước khi áp dụng sẽ giữ nguyên hình nền cũ.
6. Nếu PIN hết hạn, mở **Nhận ảnh** trên TV để tạo mã mới. Nếu máy không cùng mạng hoặc bộ nhận ảnh không hoạt động, kiểm tra kết nối và thử lại sau; không mở cổng 8765 ra Internet.

Ảnh cá nhân được gửi đến TV trong mạng nội bộ, không đi qua server của dự án trong thiết kế hiện tại. Hãy dùng ảnh bạn có quyền sử dụng; không dùng mạng Wi-Fi công cộng khi chuyển ảnh riêng tư.

## Ghi chú phát hành
Đây là tài liệu cho **bản nguồn thử nghiệm**. Kênh tải IPK cài đại trà chưa mở, vì bản V3.2.6 chưa được nghiệm thu bằng TV thật và review bảo mật độc lập.
