# Telebook Admin Panel

Telebook backend ka admin panel — **React 18 + Vite + Bootstrap 5**.
`npm start` se chalta hai.

Backend: [`telebook-backend-api`](../telebook-backend-api) — iske
`/api/admin/*` ke **saare 56 endpoints** yahan se chalte hain.

---

## Chalane ka tareeka

```bash
cd telebook-admin-panel
npm install      # ek baar
npm start        # http://localhost:3000
```

> **Node 18+ chahiye.** Is machine par shell ka default Node 14 hai, isliye
> pehle `nvm use 22.14.0` chalaiye — warna Vite start hi nahi hoga.

Production ke liye:

```bash
npm run build    # dist/ me static files
npm run preview  # build ko local me dekhne ke liye
```

`dist/` me sirf static files hoti hain — nginx, S3, Netlify, kahin bhi rakh
dijiye. HTTPS par rakhiyega: admin token browser me jaata hai.

### Server ka pata

`.env` me:

```
VITE_API_BASE_URL=http://localhost:5000
```

`/api/admin` isme NAHI likhna — woh panel khud jodta hai. Yeh build ke waqt
code me chala jaata hai, isliye badalne par `npm run build` dobara kijiye.

Khali chhod dein to panel usi origin se API maangta hai jahan se woh khud
khula hai — panel aur backend ek hi domain par hon to yeh sahi hai.

Agar kisi wajah se server se baat na ho paaye, login screen par "Server ka
pata badalna hai?" ka rasta hai — wahan se bina dobara build kiye pata badla
ja sakta hai, aur woh us browser me yaad reh jaata hai.

### Admin account

Backend ki `.env` me:

```
ADMIN_EMAIL=admin@telebook.app
ADMIN_PASSWORD=<kam se kam 8 characters>
ADMIN_NAME=Admin
```

Server boot par yeh admin ban jaata hai (`superadmin`), taaki panel me ghusne
ka rasta hamesha rahe. Teen baatein:

- Yeh sirf **banata** hai. Admin pehle se ho to uska password yahan se **nahi**
  badalta — warna panel se password badalne ka koi matlab na rehta aur purana
  password hamesha chalta rehta.
- Password 8 characters se chhota ho to admin **banta hi nahi**, aur boot par
  saaf likh deta hai.
- Password bhool jaane par:
  `node scripts/create-admin.js "Name" email newpassword`

Baaki admin panel ke andar se hi bante hain (**Admin users** page).

---

## Kya-kya hai

| Page | Kaam | Permission |
|---|---|---|
| **Dashboard** | paisa (aaya / wapas / haath me), plan ki sehat, naye users ka chart, app ki hulchul, coins ka hisaab — sab date range ke saath. Upar "dhyan do" wali baatein (pending reports, over-limit users, 7 din me khatam hone wale plan) | `users.view` |
| **Analytics** | wahi cheezein gehrai me, 6 tabs me: paisa (din/hafta/maheena, kis plan se, kis raste se), plans, **plan wale users ki poori list** (kitna diya, kab khatam), users ki growth, coins ka aana-jaana, aur app ki hulchul | `payments.view` / `plans.view` / `users.view` |
| **Users** | search, filter, over-limit list; ek user ka poora haal — profile, plan + uski limits, wallet, activity, devices. Account suspend/restore, message limit, counter zero, plan dena, coins adjust, device logout | `users.view` (+ `users.block`, `users.limit`) |
| **Chats** | chat ki list aur ginti; chat kholne par poori baat (database me encrypted hai, yahan khul kar aati hai); poore system me message search; aur **chat export** (JSON ya padhne layak text). Har dekhna aur har export audit log me jaata hai | `messages.view` (+ `messages.export`) |
| **Reports** | moderation queue. Report ki gayi **asli cheez** (message/channel/group/status) saamne dikhti hai, aur ek jagah se action: dismiss / content hatao / account band / dono | `reports.view` (+ `reports.act`) |
| **Plans** | plan ka daam, duration, badge, limits, store product IDs | `plans.view` (+ `plans.edit`) |
| **Subscriptions** | kiska plan chalu hai, kaise aaya (manual/play/gateway), kab khatam. Plan dena, extend, cancel | `plans.view` (+ `subscriptions.grant`) |
| **Coins** | wallets, poora ledger, coin packs, aur **rates** (billing unit, audio/video ka daam, boost options) | `coins.view` (+ `coins.adjust`, `coins.config`) |
| **Payments** | teeno mode on/off (+ kya asal me chal raha hai), aur sab transactions mode/status ke hisaab se | `payments.view` (+ `payments.config`) |
| **Channels** | channels, sponsored dikhte hain; moderation ke liye "posts hatao" | `channels.view` (+ `channels.moderate`) |
| **Boosts** | chalu aur purane boosts, kitne coins aaye; boost cancel (refund ke saath ya bina) | `channels.view` (+ `boosts.manage`) |
| **Stickers** | premium sticker packs — banao, badlo, sticker jodo, hatao | `stickers.manage` |
| **Announcements** | sab users ko soochna — app me banner ki tarah. Audience (sab / plan wale / free), schedule, expiry, action button, aur push (alag button, confirm ke saath) | `announcements.manage` |
| **Settings** | **saari runtime settings** — defaults.js ke tree se khud banti hain | `settings.view` (+ `settings.edit`) |
| **Audit log** | admin ne kya kiya, kya badla (before → after), kyun | `audit.view` |
| **Admin users** | admin accounts, roles, extra/denied permissions | `admins.manage` |

Sidebar me **sirf wahi page dikhta hai jiski permission hai** — login ke
jawab me aayi permission list se nav filter hota hai. Backend phir bhi
har request par apni jaanch karta hai (panel ka filter sirf suvidha hai,
suraksha nahi).

---

## Kuch cheezein jaan-boojh kar aisi hain

**Token `sessionStorage` me rehta hai, `localStorage` me nahi.**
Tab band karne par session chali jaati hai. Admin panel kisi aur ke computer
par khula reh jaane ka khatra isse kam hota hai. API base URL `localStorage`
me rehta hai (woh koi raaz nahi).

**`.env` se bandhi settings read-only dikhti hain.**
Teen monetisation switch (`FEATURE_COINS`, `FEATURE_PLANS`, `FEATURE_BOOSTS`)
server ki `.env` se aa sakte hain. Tab Settings page unhe disable kar deta hai
aur env variable ka naam likh deta hai — kyunki badalne ki koshish par backend
`409 ENV_LOCKED` deta hai. Unhe badalne ke liye server ki `.env` badlo aur
restart karo.

**Settings page koi key hard-code nahi karta.**
Woh `GET /settings` ke `settings` + `defaults` tree se khud banta hai. Backend
me `src/config/defaults.js` me nayi tunable jodo — woh apne aap yahan aa
jaayegi, sahi input type ke saath, "changed" badge aur "reset to default" ke
saath. Panel ko chhune ki zarurat nahi.

**Paise wale kaam par reason zaroori hai.**
Coins adjust, account suspend, boost cancel, posts hatana — sab me reason
maanga jaata hai, kyunki woh audit log me jaata hai. Yeh backend ka niyam hai,
panel usi ko dohrata hai.

**Chat padhna alag permission maangta hai.**
`messages.view` `users.view` se alag hai, aur `messages.export` usse bhi alag. Ek
`moderator` report nipta sakta hai aur aas-paas ki baat padh sakta hai, par poori
chat le ja nahi sakta. `viewer` private chat bilkul nahi padh sakta — iska dhyan
rakhna pada, kyunki viewer ki permissions pehle `.view` se khatam hone wale naam se
apne aap banti thin aur `messages.view` chup-chaap usme shaamil ho gayi thi.

**Message encrypted hain, par search chalti hai.**
Database me content AES-256-GCM se encrypted hai. Panel me woh khul kar aata hai.
Search ek "blind index" par chalti hai, isliye **poora ya shuru ka shabd** chalta
hai ("meet" se "meeting" milega) par shabd ke beech ka tukda nahi ("eeti" se nahi).
Search box ke neeche yeh likha bhi hai.

**Push save karne se nahi jaata.**
Announcement banate waqt push nahi jaata — uska apna button hai aur woh confirm
maangta hai. Wajah seedhi hai: soochna me typo theek karna aam baat hai, aur har
save par push jaata to har typo laakh phone baja deta.

**Plan naya banane ka button nahi hai.**
Plan ka `code` app aur store ke product IDs se bandha hota hai, isliye naye
plan seed script se aate hain (`src/config/seedPlans.js`). Panel unka daam,
limits aur dikhna badalta hai. Plan edit karne par **purane subscribers ki
shartein nahi badalti** — unke paas kharidte waqt ka snapshot hota hai.

**Sticker upload panel se nahi hota.**
Sticker ki files app ka wahi presigned upload (`/api/media/presign`,
`purpose: "sticker"`) istemal karti hain; panel me unki storage **key** paste
hoti hai. Isse do alag upload raste nahi banate.

---

## Code ka naksha

```
index.html              Vite ka entry
.env                    VITE_API_BASE_URL
src/
  main.jsx              React root — Bootstrap CSS, router, providers
  App.jsx               ROUTES, navbar, sidebar, permission-filtered menu
  Login.jsx             email + password
  auth.jsx              kaun logged in hai (context) — me, signIn, signOut
  api.js                token store, request(), 401 handling, can()
  useApi.js             data laane ka hook (loading/error/reload)
  styles.css            Bootstrap ke upar sirf utna hi jitna zaroori hai
  ui/
    index.jsx           Table, Pager, Card, Stat, Badge, BarChart, Spinner
    Modal.jsx           Modal + ConfirmBox
    Toast.jsx           toast + showError
    format.js           fmtDate, fmtNum, fmtMoney…
  pages/*.jsx           16 page
```

Har page ek React component hai. Filter aur page number URL ke query me
rehte hain (`useSearchParams`), isliye koi bhi screen share ki ja sakti hai
aur refresh par wahi dikhti hai.

**Bootstrap ka JavaScript jaan-bujh kar nahi liya — sirf CSS.** Bootstrap ka
JS DOM ko khud khol-band karta hai aur React bhi usi node ko sambhalta hai;
dono ek saath chalein to modal kabhi band hi nahi hota ya backdrop screen par
atka reh jaata hai. Isliye modal, dropdown aur sidebar React me likhe gaye
hain — markup wahi Bootstrap ka hai, control React ke paas.

**Chart ke liye koi library nahi.** Chaar bar chart ke liye 300 KB ki
charting library mangwana theek nahi lagta; inline SVG se kaam ho jaata hai
(`ui/index.jsx` ka `BarChart`).

Naya page jodna: `src/pages/` me component banaiye, `App.jsx` me import
karke `ROUTES` me ek line jodiye (`path`, `title`, `icon`, `el`, `perm`).

## Panel toot na jaaye

Panel browser me chalta hai, isliye uske test backend ke saath hain:

```bash
cd ../telebook-backend-api
node src/server.js                      # dusre terminal me
node tests/t12-panel-contract.js        # 130 assertions
```

Yeh suite har page ke liye **uski API ki shape** jaanchti hai — panel jis field
ko padhta hai, backend woh bhej raha hai ya nahi. Panel me naya field padho to
us suite me uski line bhi jodo.

---

## Browser

Chrome / Edge / Firefox / Safari — 2021 ke baad ka koi bhi version. Vite
modern browsers ke liye build karta hai; admin panel hai, isliye yeh theek hai.
