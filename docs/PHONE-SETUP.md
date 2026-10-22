# التركيب من جوال أندرويد (بدون كمبيوتر)

كل الأدوات في `optimize/` مكتوبة بـ Python ولا تحتاج برنامج adb، فتشتغل من تطبيق **Termux** على الجوال.
الجوال والتلفزيون لازم يكونون على **نفس شبكة الواي فاي**.

## ١. على التلفزيون

الإعدادات ← النظام (أو تفضيلات الجهاز) ← حول ← اضغط OK على **Build / رقم الإصدار** سبع مرات ←
ارجع ← خيارات المطوّر ← شغّل **USB debugging** (و**Network debugging** إن وُجد).

## ٢. على الجوال

ثبّت **Termux** من F-Droid أو من صفحة إصداراته في GitHub (نسخة متجر Google Play قديمة ولا تشتغل):
https://f-droid.org/packages/com.termux/

افتح Termux والصق هذي الأوامر، كل سطر لحاله:

```
termux-wake-lock
pkg update -y
pkg install -y git python python-cryptography python-pillow
git clone https://github.com/Bugami/AB_myTV
cd AB_myTV
optimize/setup.sh
optimize/find-tv.sh
```

`termux-wake-lock` يخلي الجوال ما يوقف Termux وهو يشتغل. آخر أمر يدوّر على التلفزيون في الشبكة.

## ٣. الاتصال بالتلفزيون

```
optimize/venv/bin/python -I optimize/tv.py --probe
```

بتطلع على التلفزيون رسالة «Allow USB debugging?»: اضغط **Allow** وعلّم **Always allow**.

## ٤. التركيب (٢٠–٤٠ دقيقة، التلفزيون يعيد التشغيل مرتين)

```
optimize/run.sh
```

إذا وقف لأي سبب، شغّل نفس الأمر مرة ثانية ويكمل من مكانه. `optimize/run.sh status` يوريك وين وصل.

## ٥. الإعدادات

```
optimize/saver.sh city الرياض
optimize/saver.sh card verse
optimize/saver.sh home-card none
optimize/saver.sh update
optimize/saver.sh show
```

## الرجوع مثل ما كان

```
optimize/reset.sh
```

يرجّع التطبيقات اللي انطفت، وواجهة التلفزيون الأصلية وشاشة توقفه، ويشيل تطبيقاتنا.
