# 🔥 วิธี Setup Firebase สำหรับ TripShare

## ขั้นตอนที่ 1 — สร้าง Firebase Project

1. ไปที่ **https://console.firebase.google.com**
2. กด **"Add project"** → ตั้งชื่อ เช่น `tripshare`
3. ปิด Google Analytics (ไม่จำเป็น) → กด **"Create project"**

---

## ขั้นตอนที่ 2 — เปิด Firestore Database

1. เมนูซ้าย → **Build → Firestore Database**
2. กด **"Create database"**
3. เลือก **"Start in test mode"** (อ่าน-เขียนได้ 30 วัน — แก้ rules ทีหลังได้)
4. เลือก Region ที่ใกล้ที่สุด เช่น `asia-southeast1` (Singapore) → **Done**

---

## ขั้นตอนที่ 3 — เปิด Anonymous Authentication

1. เมนูซ้าย → **Build → Authentication**
2. กด **"Get started"**
3. แท็บ **Sign-in method** → กด **Anonymous** → เปิด Enable → **Save**

---

## ขั้นตอนที่ 4 — ดึง Firebase Config

1. เมนูซ้าย → ⚙️ **Project settings** (ไอคอนฟันเฟือง)
2. แท็บ **General** → เลื่อนลงหา **"Your apps"**
3. กด **"</>"** (Web app) → ตั้งชื่อ เช่น `tripshare-web` → **Register app**
4. จะเห็น config แบบนี้:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tripshare-xxxxx.firebaseapp.com",
  projectId: "tripshare-xxxxx",
  storageBucket: "tripshare-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## ขั้นตอนที่ 5 — วาง Config ลงในไฟล์

เปิดไฟล์ **`index.html`** หาบรรทัดนี้:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  ...
};
```

แทนที่ด้วย config ที่คัดลอกมาจากข้อ 4 แล้วบันทึกไฟล์

---

## ขั้นตอนที่ 6 — แก้ Firestore Security Rules (หลัง 30 วัน)

ไปที่ **Firestore → Rules** แล้ววางนี้แทน:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tripshare/shared {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Rules นี้เปิดให้ทุกคนอ่าน-เขียนได้ เหมาะกับกลุ่มเพื่อนที่ไว้ใจกัน
> ถ้าต้องการความปลอดภัยมากกว่านี้ สามารถเพิ่ม auth check ได้ทีหลัง

---

## ขั้นตอนที่ 7 — Push ขึ้น GitHub Pages

```bash
git add .
git commit -m "add firebase"
git push
```

รอ 1-2 นาที แล้วเปิด URL ของ GitHub Pages ได้เลยครับ ✅

---

## ✅ ทดสอบ

- เปิด URL บนมือถือเครื่องหนึ่ง → เพิ่มทริป
- เปิด URL บนมือถืออีกเครื่อง → ข้อมูลต้องขึ้นเหมือนกัน
- ถ้าไม่ขึ้น → เช็ค browser console (F12) ดู error

---

## 💰 ค่าใช้จ่าย Firebase (Free Tier)

| รายการ | ฟรี |
|--------|-----|
| Firestore reads | 50,000 ครั้ง/วัน |
| Firestore writes | 20,000 ครั้ง/วัน |
| Anonymous users | ไม่จำกัด |

> สำหรับกลุ่มเพื่อน 10-20 คน ใช้ฟรีได้สบายๆ ครับ
