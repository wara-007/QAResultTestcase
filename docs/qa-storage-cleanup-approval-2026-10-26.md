# รายการสำเนา Excel ที่อนุมัติและลบแล้ว — 26 ตุลาคม 2026

สถานะ: ผู้ใช้ยืนยัน “ยืนยันลบ 131 รุ่นตามรายการ” แล้ว ดำเนินการครบ 131 รุ่น คืนพื้นที่จริง 2,102,419,929 ไบต์ เมื่อ 26 ตุลาคม 2026 เวลา 01:05 น. และปลดล็อกการบันทึกแล้ว

- จำนวน: 131 รุ่น จากโปรเจคที่เชื่อม Sheets
- พื้นที่ตามทะเบียน: 2,102,419,929 ไบต์ (ประมาณ 2.10 GB)
- ขอบเขต: ลบเฉพาะ object ของสำเนาเก่าตามรายการด้านล่าง เก็บ metadata พร้อมบันทึกการลบ ไม่ลบเคส/ผล/Sheets/Drive evidence
- กันไฟล์ล่าสุด ไฟล์ที่เคส/Export/Sprint/PO/ประวัติอ้างอิง และไฟล์ที่ไม่ยืนยันที่มาจาก Sheets ออกแล้ว
- ระหว่างลบจะมี write guard ชั่วคราว อ่านได้ แต่การบันทึกต้องลองใหม่หลังปลดล็อก
- การลบ object เป็นการลบถาวร ไม่มี Trash ของแอป
- ตรวจหลังลบ: พื้นที่ตามทะเบียนประมาณ 1.63 GB แต่ Storage objects จริงรวม 2,264,349,790 ไบต์ (2.264 GB), 318 objects; ยังเกิน Free 1 GB และมีส่วนต่างที่ต้องตรวจที่มาก่อนลบต่อ

Fingerprint ของรายการ: `ade979be29cbf96471ff1f1db33687972792928257f651315747ec8e7d38ee5d`

| Project | จำนวนรุ่น | MB |
|---|---:|---:|
| Regression : TrueApp preprod 11.1002.0 | 30 | 677.47 |
| Verify Device Recommend with "sourceSystem" = TRUEAPP | 1 | 3.90 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 31 | 25.40 |
| QA - [UAT] - TOL Reboot Router | 5 | 53.78 |
| EX: Stepname | 4 | 5.83 |
| Web Handle Error 404 | 12 | 89.74 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 14 | 524.02 |
| Pay ban cancel | 6 | 197.11 |
| Regression test True app version 11.1002.0 Payment Module 2.11.0 | 2 | 87.90 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 6 | 346.84 |
| QA - [Preprod] Regression FE-Preprod 11.1002.0 | 2 | 8.19 |
| [SUN-8217][SUN-8336] BE - [PRF] Enhance /api/v1/operator/get return error 70031 when productId is not in mobile format | 1 | 2.13 |
| TMN on ddchpackage (mobile app) | 1 | 0.39 |
| Personalize Refill Campaign | 1 | 55.08 |
| Enhance Offer Package Page to Sortable Items | 2 | 7.64 |
| Disable "Buy now" and cooldown 3 Minute on App | 3 | 4.28 |
| [SUN-8383] BE - Improve Transaction History TMH Prepaid : FetchedRange | 2 | 3.72 |
| Transaction history with tag | 1 | 0.21 |
| [K+ ddch] Error code mapping. (App) | 1 | 0.39 |
| Regression TrueApp (test) | 2 | 0.37 |
| Enhance Shopping Landing Page with List View | 1 | 1.09 |
| test | 1 | 0.27 |
| [SUN-8148]Phase 1 - Improve termAndCon open PDF | 1 | 6.30 |
| TMN on ddchpackage (App) | 1 | 0.39 |

## รายการแต่ละรุ่น

| Project | Version | Source ID | MB |
|---|---:|---|---:|
| Regression : TrueApp preprod 11.1002.0 | 1 | `d1b25b9b-7827-42e0-a104-83f8b2d5e93a` | 0.08 |
| Regression : TrueApp preprod 11.1002.0 | 2 | `fce250af-1214-45cf-a55d-2668cf451aa0` | 0.36 |
| Regression : TrueApp preprod 11.1002.0 | 3 | `0ab1a652-e27b-4ee8-bb85-2a00c30606e4` | 0.36 |
| Regression : TrueApp preprod 11.1002.0 | 4 | `64460c47-6a85-4cb0-8ed6-3eed0812d000` | 0.36 |
| Regression : TrueApp preprod 11.1002.0 | 5 | `b103c511-2e0c-40ad-ad3f-cc57e87c4e3d` | 0.35 |
| Regression : TrueApp preprod 11.1002.0 | 6 | `5b808ff0-3af6-45f2-8a3d-c03116dbdc73` | 0.35 |
| Regression : TrueApp preprod 11.1002.0 | 7 | `b7838ac3-a0b7-4a60-9d8b-9f81cd074f42` | 0.35 |
| Regression : TrueApp preprod 11.1002.0 | 8 | `73408a07-9763-4b54-b94e-f9c1121dcbcb` | 0.35 |
| Regression : TrueApp preprod 11.1002.0 | 9 | `5ba80533-a825-46b8-8b39-07508a8b161a` | 0.35 |
| Regression : TrueApp preprod 11.1002.0 | 10 | `a601d847-07c5-4df1-a9e8-884c592402f5` | 1.06 |
| Regression : TrueApp preprod 11.1002.0 | 11 | `80b52b99-46fc-4aed-9f86-322adff2bf0e` | 1.06 |
| Regression : TrueApp preprod 11.1002.0 | 12 | `0c03c23b-4de9-45d9-8a6c-038b92651bbc` | 1.05 |
| Regression : TrueApp preprod 11.1002.0 | 13 | `fa9ee806-1cff-48e6-a298-7b2c4ac05021` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 14 | `ff06fbf2-cd42-451a-975f-db1df2474e6b` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 15 | `75627b7b-0a0e-4159-885d-16c714604336` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 16 | `b6ec67b6-7ad6-4645-b03c-f633bc801824` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 17 | `9db78c65-4524-45d4-a311-672e8823ec4b` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 18 | `8792654b-3df3-4ea4-9e16-c99ab862f414` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 19 | `31180ce6-03b8-4596-8b87-f75b8dca1fab` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 20 | `babebb78-aaf2-4f99-944d-29ad0acc1cb1` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 21 | `cfcc46e3-e8ac-4ee3-9d63-00c1cd0c7dff` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 22 | `6f2277f7-eceb-4d25-b7e7-37ef25987f2d` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 23 | `93c4f307-0c47-4d91-931e-d99cc8ce7c7e` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 24 | `4d7b62da-4205-4927-b9af-4209ed776624` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 25 | `a9d1b97a-b597-494e-8757-2da832e7abd6` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 26 | `f4aba7cd-9eaf-4189-b02b-5c5514778a16` | 37.07 |
| Regression : TrueApp preprod 11.1002.0 | 27 | `01923738-89c4-4eda-bf3a-48302aff3442` | 38.11 |
| Regression : TrueApp preprod 11.1002.0 | 28 | `e389382f-98fc-4526-866d-f1b05cb61593` | 38.11 |
| Regression : TrueApp preprod 11.1002.0 | 29 | `ea796115-9ba9-4625-998b-0a629789a5b6` | 38.11 |
| Regression : TrueApp preprod 11.1002.0 | 30 | `cd449001-ffcb-4317-a1e3-edec48d57b95` | 38.06 |
| Verify Device Recommend with "sourceSystem" = TRUEAPP | 2 | `05864b5d-8c3c-40a8-8903-10e0926dd308` | 3.90 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 1 | `ce263c52-f074-4586-97ee-10abcabd568a` | 0.81 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 2 | `91d54253-6820-4f1d-8726-b84d15593fcc` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 3 | `ec9bd564-4a62-4d19-a975-ecac2822106b` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 4 | `865af961-5642-4e77-808d-621856029a8b` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 5 | `b8efb0aa-69da-45a8-8d41-1d9b532a073e` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 6 | `a12c4c4a-a819-4a51-819d-0913f03850c2` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 7 | `0abed8ae-ea8b-4594-bc21-091c5abacea1` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 8 | `f95fe041-3e89-4aa8-bf72-5c50e49b297d` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 9 | `bda4ad26-6764-4904-b0dc-7d409b9c8720` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 10 | `26350bea-e8e4-44d0-a9fd-9c7914cac04d` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 11 | `4dfa5ec8-83e6-40a3-84ef-f684c8490ec7` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 12 | `243370b9-64a1-4ea9-8996-a9023ea997e5` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 13 | `e88bbbdd-c42e-4a93-81fd-f2793cd0cc50` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 14 | `c9d3bbf6-c2d4-490d-8036-4a38967186c1` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 15 | `22a0ba11-bed1-4889-a18a-edcdfed6795d` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 16 | `ab989023-7088-453c-b0f4-3a602fcb1387` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 17 | `ac5d758a-e85b-4884-8bde-00e904c4e28e` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 18 | `2996dc8c-cdb0-429c-8a17-88f1a32f8e8c` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 19 | `aa9da582-f1d9-4ebf-aef8-74ec0efb7926` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 20 | `0ab1714e-cc77-4ae1-887e-9003d0455fad` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 21 | `e4bde7df-1bb5-4116-937b-253b2ab83143` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 22 | `0ee840f1-ca7e-4df7-909d-fc85e044f2e7` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 23 | `22b63f28-7ff2-4689-80cc-3c32becd3ac3` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 24 | `796c022a-f76b-4be2-b6bb-52ce514e4e0c` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 25 | `25025c42-06c4-4125-9671-e6d4fad59515` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 26 | `397704dd-08d0-4dca-95f5-ed7c14108230` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 27 | `75090d51-fa9f-487e-945a-c60291fa5ab5` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 28 | `5db6fc6e-2687-4d60-927d-6a0c7266ae18` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 29 | `d72ca5d1-b743-44d1-bf6f-9107529be69d` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 30 | `1296eaa4-2f72-478f-a1c2-ff2fb3057bf2` | 0.82 |
| QA - [Preprod] Regression BE-Preprod-24SEP26 , FE-Preprod 11.1001.0 | 31 | `f43df124-a7df-4ec9-a508-be6096f8d14c` | 0.82 |
| QA - [UAT] - TOL Reboot Router | 1 | `224bc596-98c6-4e3e-879f-a5df9e23248e` | 10.76 |
| QA - [UAT] - TOL Reboot Router | 2 | `247908c0-3fda-4fb1-b11f-9955ea853b9b` | 10.76 |
| QA - [UAT] - TOL Reboot Router | 3 | `6692895e-70d5-463a-99b7-bcead2a39f26` | 10.76 |
| QA - [UAT] - TOL Reboot Router | 4 | `0c92068d-2567-42a3-bdf6-9fdc214f5f2f` | 10.76 |
| QA - [UAT] - TOL Reboot Router | 5 | `f05d7c25-1b34-457d-a920-0b93bdc6f663` | 10.76 |
| EX: Stepname | 1 | `1b79a2e6-9d0b-43cc-895a-8a18eb1e19e0` | 1.46 |
| EX: Stepname | 2 | `0e1e281a-71ae-45a1-beda-0d4dc62fd2e1` | 1.46 |
| EX: Stepname | 3 | `40b03de3-4e19-4689-958c-a800e28b2c6e` | 1.46 |
| EX: Stepname | 4 | `a68c3285-29e4-4df6-a478-a9277281c0ce` | 1.46 |
| Web Handle Error 404 | 1 | `f24698cd-997a-4890-bc95-4b9643faa3fa` | 0.74 |
| Web Handle Error 404 | 2 | `0e489432-7079-4e81-98d2-c71cdd7a6f5c` | 0.74 |
| Web Handle Error 404 | 3 | `afbd3c10-38af-489a-bc8e-5e2e83e7f079` | 0.74 |
| Web Handle Error 404 | 4 | `3ecd7e8f-cc6b-404c-b70a-60f52f9e7e66` | 9.72 |
| Web Handle Error 404 | 5 | `a4436b95-6522-4147-928d-9c5bfa70e7f4` | 9.72 |
| Web Handle Error 404 | 6 | `edbea407-d34b-4201-aa62-c356d6fd2270` | 9.72 |
| Web Handle Error 404 | 7 | `bf9cd4d7-7561-4c9c-832e-98cf2144bb60` | 9.72 |
| Web Handle Error 404 | 8 | `cc03162f-e497-40c2-9b3d-f1397214e921` | 9.72 |
| Web Handle Error 404 | 9 | `cac286b7-5ac9-48cb-a056-1407875e53c2` | 9.72 |
| Web Handle Error 404 | 10 | `553a99d5-ba71-48ee-9630-5a2976b56558` | 9.72 |
| Web Handle Error 404 | 11 | `20cb1692-bce1-486f-aecf-e826d8888ff8` | 9.72 |
| Web Handle Error 404 | 12 | `61cff828-0d89-4e26-8bce-826a901171be` | 9.72 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 1 | `560784ef-67aa-4052-b4e0-bab581b5ea25` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 2 | `d54dd777-4b8f-496a-aed9-4b8f8cfe17bf` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 3 | `184bfa5e-5f37-4890-9abf-534cd2e01231` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 4 | `11d05b15-7bb7-4b18-a388-ad2ede8b26d0` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 5 | `acb110c7-6966-4326-a514-7213769b04a2` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 6 | `fb3d83fa-ccf9-42a4-a627-122ca26b41d0` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 7 | `d69de045-f3d6-4886-a405-8159f561c74b` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 8 | `95dc0e53-03c2-48f4-b05c-fa768e3c7a06` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 9 | `8c96500a-a485-40ff-9585-b3925e94ef63` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 10 | `68631a9c-f85e-4abf-ac99-d92d535ffa03` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 11 | `123a8f86-b376-4ed4-ad79-8ab606223e2a` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 12 | `654983d9-87ef-4f34-9b0b-b68c6e50fa9c` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 13 | `6788db77-3dcb-4186-99d4-338cc8984c0a` | 37.43 |
| Release: App Version 11.1002.0 (MAR-FE V2.13.0) | 14 | `e39240db-096b-4830-a2ca-8f5228c34423` | 37.43 |
| Pay ban cancel | 1 | `157766c5-da02-4eda-b521-038871b2e782` | 32.85 |
| Pay ban cancel | 2 | `2d7bad41-688f-4480-ae13-6a3114ab9e66` | 32.85 |
| Pay ban cancel | 3 | `72de2659-1c25-4a28-a50b-b0f7e35d47fa` | 32.85 |
| Pay ban cancel | 4 | `5cefdcfc-94d7-427a-a404-a9c60dc7d62c` | 32.85 |
| Pay ban cancel | 5 | `a63afa6e-aca6-42af-8768-f5616f8427e2` | 32.85 |
| Pay ban cancel | 6 | `7bb45e8f-d11d-4cce-bb16-43f7b970092d` | 32.85 |
| Regression test True app version 11.1002.0 Payment Module 2.11.0 | 1 | `17086ff4-d6ba-4795-82ab-2c2b5090b5be` | 43.95 |
| Regression test True app version 11.1002.0 Payment Module 2.11.0 | 2 | `d4d56359-7808-45ae-9bd3-2fd533f730da` | 43.95 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 1 | `8a628b1e-2019-438b-bdb1-63ad21a80f52` | 29.71 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 2 | `203d85a5-5ea1-49ea-816d-28434694ac2a` | 29.71 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 3 | `43696865-f7d6-4bd8-b237-aade209b1099` | 71.85 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 4 | `f466f58f-4315-4f76-9e57-9a924648d338` | 71.91 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 5 | `187de53e-bfff-416b-8644-5509600fae38` | 71.82 |
| QA - [Preprod] Regression Test :: BE-Preprod-12Oct26, FE-11.1002.0 (22Oct26) | 6 | `40dc3c34-b8bb-4626-bbb1-f9a075fbf576` | 71.83 |
| QA - [Preprod] Regression FE-Preprod 11.1002.0 | 1 | `c986af19-4af5-43d1-b94b-23c7295e1952` | 4.10 |
| QA - [Preprod] Regression FE-Preprod 11.1002.0 | 2 | `2a2d5ed1-41e7-46bf-87a1-4e9b401ece6d` | 4.10 |
| [SUN-8217][SUN-8336] BE - [PRF] Enhance /api/v1/operator/get return error 70031 when productId is not in mobile format | 1 | `347f385d-13f2-4bcb-bfc5-27544bf9942f` | 2.13 |
| TMN on ddchpackage (mobile app) | 1 | `451f81dc-c1e4-4eef-af81-57c0a25362e6` | 0.39 |
| Personalize Refill Campaign | 1 | `528a544d-80b4-482f-bb0b-8caaa2d3fe23` | 55.08 |
| Enhance Offer Package Page to Sortable Items | 1 | `590b0854-74a8-451d-973e-0a62c8c88807` | 3.82 |
| Enhance Offer Package Page to Sortable Items | 2 | `6d587f6c-8ae5-44ff-99e5-8db0fb36fb4d` | 3.82 |
| Disable "Buy now" and cooldown 3 Minute on App | 1 | `59b70aa8-82a4-4428-bd52-585400a6f21e` | 1.42 |
| Disable "Buy now" and cooldown 3 Minute on App | 2 | `ad943d56-e94a-4c73-8812-52660b416619` | 1.43 |
| Disable "Buy now" and cooldown 3 Minute on App | 3 | `df82dddd-a4b1-4ffe-8e64-4c98707a53b4` | 1.43 |
| [SUN-8383] BE - Improve Transaction History TMH Prepaid : FetchedRange | 1 | `80032b55-ecf8-4f62-bef5-90f26dc79855` | 1.86 |
| [SUN-8383] BE - Improve Transaction History TMH Prepaid : FetchedRange | 2 | `60fbf167-8470-4780-99f4-ed01ff52c520` | 1.86 |
| Transaction history with tag | 2 | `619cb2a5-c5ac-4053-9bd3-4284a5b6f605` | 0.21 |
| [K+ ddch] Error code mapping. (App) | 1 | `6aa0a138-27f0-43ac-b7bd-92374d834da7` | 0.39 |
| Regression TrueApp (test) | 1 | `caea7999-0135-4a43-bd2b-184b354f4014` | 0.18 |
| Regression TrueApp (test) | 2 | `7d3a4077-44ac-416e-a7e2-d8473dcb2205` | 0.18 |
| Enhance Shopping Landing Page with List View | 1 | `88993666-a13b-4887-b117-6fab28994f46` | 1.09 |
| test | 1 | `9f9c10ce-7bb6-406a-9d41-6b0e92038fc2` | 0.27 |
| [SUN-8148]Phase 1 - Improve termAndCon open PDF | 1 | `ed44c916-b7bb-4cb8-ad40-a61919b5d477` | 6.30 |
| TMN on ddchpackage (App) | 1 | `fb3f392f-c4f9-4496-ab39-6d5e33a7f2d8` | 0.39 |
