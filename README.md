# Login System (Starter)

เว็บตัวอย่างล็อกอินด้วย Express พร้อมโครง deploy ใช้งานจริง

## Run Local

```bash
npm install
npm start
```

เปิดที่ `http://localhost:3000`

บัญชีทดสอบ:
- username: `admin`
- password: `admin123`

## Production Checklist

1. ตั้งค่า `SESSION_SECRET` เป็นค่ายาวและปลอดภัย
2. ตั้ง `NODE_ENV=production`
3. ต่อฐานข้อมูลจริงแทน in-memory store
4. เปิด HTTPS (โฮสต์ส่วนใหญ่มีให้)
5. เพิ่ม rate limit และระบบ log

## Deploy on Render

1. Push โค้ดขึ้น GitHub
2. ใน Render เลือก `New +` -> `Blueprint`
3. เลือก repository นี้ (มี `render.yaml`)
4. Deploy ได้ทันที
