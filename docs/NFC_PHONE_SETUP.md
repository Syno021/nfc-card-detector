# Using a Phone as Your NFC Token

The app supports **any NFC tag or device** that exposes an ID the reader can use: physical cards (NfcA, Mifare Classic), NDEF tags, and **phones** that emulate NDEF or act as NFC targets. This guide explains how to use a phone (Android) as your NFC “card” so the detector can identify you.

## How the detector reads IDs

1. **Tag UID** – Physical cards and many tags expose a UID. The detector uses this when available.
2. **NDEF payload** – If there’s no UID (or it’s not usable), the detector reads the first **NDEF text record** or the first record’s payload as the user ID. So a phone (or any tag) that writes an NDEF message with your **user ID** (the same value stored in Firebase as `nfcId`) will work.

## Option A: NDEF tag / phone emulating NDEF (recommended)

Use this when the **detector device** (tablet/phone running the app) reads your **phone** (or an NDEF tag) by tapping.

### 1. Get your user ID from Firebase

Your user document in Firestore has a field `nfcId`. That value is what the detector uses to look you up. For example:

- `04:A1:B2:C3:D4` (from a physical card UID), or  
- Any string you choose when using a phone (e.g. `user-abc123` or a UUID).

An admin can set or change `nfcId` in the app (e.g. “Assign NFC” from the user profile).

### 2. Write that ID into an NDEF message on the phone

On the **phone that will be tapped** (the “card”):

- Use an NFC app that can **write** NDEF records, or use a small companion app (see below).
- Write **one NDEF record** whose payload is exactly your **user ID** string (the same as `nfcId` in Firebase).
  - **Simplest:** one **Text** record with payload = your user ID.
  - **Optional:** use the app-specific type `application/vnd.nfc-card-detector.user` with payload = your user ID; the detector checks for this type first.

When the detector reads your phone (or tag), it will:

1. Try the tag UID (if any).
2. If no UID or not usable, read NDEF and use the first text record (or first record’s payload) as the user ID.
3. Look up that ID in Firebase (`users` where `nfcId == that ID`) and, if found, open the user profile.

### 3. Android “card” emulation (NDEF)

- **NFC TagWriter / NFC Tools, etc.** – Write a new NDEF **Text** record; set the text content to your **user ID** (same as `nfcId`). Save and set it as the default tag content if the app supports it.
- **Custom Android app** – Use the Android **NFC foreground dispatch** or **reader/writer** APIs to push an NDEF message when in range. The message should contain one record with payload = your `nfcId` (e.g. Text record or custom type `application/vnd.nfc-card-detector.user`). When the detector device taps this phone, it will see that NDEF and use the payload as the user ID.

**Note:** On Android, “host card emulation” (HCE) often uses **IsoDep**; the detector also requests IsoDep, so some HCE apps may work if they expose a compatible ID. For the most reliable “phone as card” flow, we recommend **NDEF** (write or push the user ID in an NDEF payload).

## Option B: Android HCE (advanced)

If you build an Android app that uses **Host Card Emulation (HCE)**:

- The detector requests **NfcA, Ndef, IsoDep, MifareClassic**. So the HCE service must emulate one of these.
- The detector uses the **tag ID** from the reader (e.g. from the emulated tag). If your HCE app can present a stable ID that you store in Firebase as `nfcId`, the detector will match it and open the profile.
- HCE behavior is device- and OS-dependent; for most cases, **NDEF** (Option A) is simpler and more portable.

## Summary

| Source of ID        | How detector gets it                          |
|--------------------|-------------------------------------------------|
| Physical NFC card  | Tag UID (NfcA / Mifare Classic, etc.)          |
| NDEF tag / phone   | First NDEF text record or first record payload |
| App-specific type  | Record type `application/vnd.nfc-card-detector.user` (optional) |

**Steps for “phone as card”:**

1. Have an admin set your **nfcId** in Firebase (or use an existing one).
2. On the phone you’ll tap, write an NDEF message with **one record** whose payload is that **nfcId** (e.g. Text record).
3. Tap that phone to the detector device; the app will look up the ID and show your profile.

No change is required on the detector app beyond the current multi-tech + NDEF support; it already supports cards and phones that provide a UID or an NDEF payload equal to the user’s `nfcId`.
