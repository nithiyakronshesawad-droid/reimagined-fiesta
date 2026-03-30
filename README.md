# Login System (Starter)

เว็บตัวอย่างล็อกอินด้วย Express พร้อมโครง deploy ใช้งานจริง (SQLite + bcrypt + rate limit)

## Run Local

```bash
npm install
npm start
```

เปิดที่ `http://localhost:3000`

บัญชีเริ่มต้น:
- username: `admin`
- password: `admin123` (ควรเปลี่ยนทันทีผ่าน ENV)

## Production Checklist

1. ตั้งค่า `SESSION_SECRET` เป็นค่ายาวและปลอดภัย
2. ตั้ง `ADMIN_PASSWORD` เป็นค่าที่เดายาก
3. ตั้ง `NODE_ENV=production`
4. ตั้ง `DB_DIR` ให้เป็นโฟลเดอร์ที่เขียนได้
5. เปิด HTTPS (โฮสต์ส่วนใหญ่มีให้)
6. ใน Render Free ดิสก์ไม่ถาวร หากต้องการข้อมูลผู้ใช้คงอยู่ให้เพิ่ม persistent disk

## Deploy on Render

1. Push โค้ดขึ้น GitHub
2. ใน Render เลือก `New +` -> `Blueprint`
3. เลือก repository นี้ (มี `render.yaml`)
4. Deploy ได้ทันที
