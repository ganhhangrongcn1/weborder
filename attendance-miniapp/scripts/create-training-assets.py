"""Generate original demo training assets; no customer or employee data."""
from pathlib import Path
import sys, subprocess
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools'))
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
import imageio_ffmpeg

assets = ROOT / 'src' / 'assets'
frames = ROOT / 'tmp' / 'training'
assets.mkdir(parents=True, exist_ok=True)
frames.mkdir(parents=True, exist_ok=True)
font = 'C:/Windows/Fonts/arial.ttf'
bold = 'C:/Windows/Fonts/arialbd.ttf'
pdfmetrics.registerFont(TTFont('ArialVN', font))
pdfmetrics.registerFont(TTFont('ArialVNBold', bold))
pdf = canvas.Canvas(str(assets / 'huong-dan-cham-cong.pdf'), pagesize=(595,842))
pdf.setTitle('Gánh Hàng Rong - Hướng dẫn chấm công')
pdf.setFillColor(HexColor('#292621')); pdf.rect(0,745,595,97,fill=1,stroke=0)
pdf.setFillColor(HexColor('#ffffff')); pdf.setFont('ArialVNBold',22)
pdf.drawString(42,790,'GÁNH HÀNG RONG')
pdf.setFont('ArialVN',12); pdf.drawString(42,765,'Hướng dẫn chấm công nhân viên')
lines = [
("1. Đăng nhập", ["Sử dụng tài khoản nhân viên hoặc quản lý được cấp.","Khi cần hỗ trợ tài khoản, liên hệ quản lý cửa hàng."]),
("2. Vào và ra ca", ["Chọn phương thức GPS hoặc GPS kết hợp QR cửa hàng.","Kiểm tra vị trí trước mỗi lần chấm công.","Bấm Vào ca hoặc Ra ca, sau đó kiểm tra kết quả."]),
("3. Điều chỉnh công", ["Chọn ca làm, nhập giờ đề nghị và lý do cần điều chỉnh.","Đính kèm ảnh hoặc tài liệu minh chứng nếu cần.","Quản lý đối chiếu yêu cầu và phản hồi kết quả xử lý."]),
("4. Đối chiếu giờ công", ["Xem lịch sử chấm công theo tháng.","Kiểm tra thời gian vào, ra và số giờ từng ca.","Tải bảng công để đối chiếu khi cần."]),
("5. Quyền riêng tư", ["Vị trí chỉ được lấy khi bạn chủ động thực hiện thao tác.","Camera chỉ dùng khi bạn chọn chụp ảnh xác nhận.","Số điện thoại chỉ được lấy sau khi bạn đồng ý cung cấp.","Ứng dụng không theo dõi vị trí liên tục."]),]
y=710
for title, body in lines:
    pdf.setFillColor(HexColor('#292621')); pdf.setFont('ArialVNBold',13); pdf.drawString(42,y,title); y-=25
    pdf.setFillColor(HexColor('#41473e')); pdf.setFont('ArialVN',11)
    for line in body: pdf.drawString(42,y,line); y-=19
    y-=17
pdf.setFont('ArialVN',9); pdf.drawString(42,32,'GÁNH HÀNG RONG / HƯỚNG DẪN CHẤM CÔNG')
pdf.save()

slides=[
('01', 'Bắt đầu ca mới', ['Đăng nhập tài khoản nhân viên.', 'Kiểm tra vị trí tại cửa hàng.']),
('02', 'Xác nhận vào ca', ['Chọn GPS hoặc kết hợp GPS + QR.', 'Bấm Vào ca và kiểm tra thông báo.']),
('03', 'Kết thúc ca làm', ['Kiểm tra vị trí một lần nữa.', 'Bấm Ra ca, xem lại lịch sử công.']),
('04', 'Trao đổi điều chỉnh', ['Chọn ca, ghi lý do và minh chứng.', 'Quản lý xem xét và phản hồi yêu cầu.']),
('05', 'Theo dõi giờ công', ['Xem lịch sử chấm công theo tháng.', 'Tải bảng công để đối chiếu.'])]
for index,(number,title,body) in enumerate(slides):
    im=Image.new('RGB',(960,540),'#f5f3ef'); draw=ImageDraw.Draw(im)
    draw.rectangle((0,0,16,540),fill='#292621')
    draw.text((64,44),'GÁNH HÀNG RONG / CHẤM CÔNG',font=ImageFont.truetype(bold,21),fill='#292621')
    draw.text((64,124),number,font=ImageFont.truetype(font,58),fill='#a23d32')
    draw.text((64,210),title,font=ImageFont.truetype(bold,46),fill='#292621')
    for j,line in enumerate(body): draw.text((64,300+j*48),line,font=ImageFont.truetype(font,27),fill='#7b746b')
    draw.line((64,470,896,470),fill='#e4dfd8',width=2)
    draw.rectangle((64,470,64+int(832*(index+1)/len(slides)),474),fill='#292621')
    draw.text((64,493),'GÁNH HÀNG RONG · HƯỚNG DẪN NHÂN VIÊN',font=ImageFont.truetype(font,16),fill='#70766f')
    im.save(frames / f'slide-{index:02}.png')
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([ffmpeg,'-y','-framerate','1/6','-i',str(frames/'slide-%02d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-r','24','-movflags','+faststart',str(assets/'huong-dan-cham-cong.mp4')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
print('Created Vietnamese PDF + 30-second MP4 training assets.')
