# รายการลบเพิ่มเติมเพื่อลด Storage ต่ำกว่า 1 GB — 26 ตุลาคม 2026

สถานะ: ดำเนินการแล้วตามคำสั่งผู้ใช้ “ทำต่อได้เลย” หลังแจ้งจำนวนและเป้าหมาย ลบครบ 20 รุ่นเก่าและ 83 objects ที่ไม่มีทะเบียน รวม 214 objects / 1,599,197,060 ไบต์ และปลดล็อกการบันทึกสำเร็จ

| รายการ | จำนวน | ขนาด |
|---|---:|---:|
| Excel รุ่นเก่าที่ไม่มีการอ้างอิง | 20 รุ่น | 965.05 MB |
| object ที่ไม่มีทะเบียน อายุเกิน 24 ชั่วโมง และไม่มีการอ้างอิง | 83 ชิ้น | 634.14 MB |
| รวมลบ | 214 objects | 1.599 GB |
| คงเหลือตามที่ตรวจ | 104 objects | 665.15 MB |

## ผลกระทบและสิ่งที่เก็บไว้

- เป็นการลบถาวร ไม่มี Trash ของแอป
- Excel เก่า 20 รุ่นนี้บางรายการไม่มีบันทึกยืนยันที่มาว่าเป็น Sheets หรืออัปโหลดเอง การยืนยันครอบคลุมการทิ้งสำเนารุ่นเก่าเหล่านี้ด้วย
- ตรวจไม่มีการอ้างอิงจากเคส ผลทดสอบ/หลักฐาน Export ประวัติ Sprint รายการส่ง PO และประวัติโปรเจค
- เก็บไฟล์รุ่นล่าสุดทั้งหมด ข้อมูลเคส ผลทดสอบ Google Sheets และรูปใน Drive
- ก่อนลบจริงต้องตรวจรายการซ้ำภายใต้ write guard เดิม หากรายการเปลี่ยนหรือพบการอ้างอิงต้องหยุด
- ตัวเลข 665 MB คือพื้นที่ไฟล์ปัจจุบันหลังลบตามรายการ ค่าเฉลี่ยรอบบิลและแบนเนอร์อาจยังไม่ลดทันที

Fingerprint: `fadc9b44418c2b3705545424d0009a79b15c393236f8f231a319154b3a0c459a`

## Excel รุ่นเก่า 20 รุ่น

| Project | Version | Source ID | MB |
|---|---:|---|---:|
| Cross sell before checkout | 1 | `d375ac1a-605e-4aa7-8d87-a69174ff208f` | 0.23 |
| Cross sell before checkout | 2 | `66441cd0-765a-4de0-aa3e-419d6b801288` | 0.23 |
| Cross sell before checkout | 3 | `ba9a8497-52f3-4ebd-b22a-c54085668644` | 0.22 |
| Cross sell before checkout | 4 | `c05f16df-5324-47e9-9ec4-f95433154061` | 0.22 |
| Cross sell before checkout | 5 | `a89394d5-34a6-4062-b14b-e75e0d2c7005` | 0.26 |
| Result Testing [SUN-3503] Bill and Usage phase 1 | 1 | `6050f4a7-8c09-4260-8262-65eef9a42e2b` | 88.80 |
| Result Testing [SUN-3503] Bill and Usage phase 1 | 2 | `8e6447a2-f95b-48e7-86a8-82521cc2b9ce` | 88.80 |
| Testcase - Regression true app target android16 sdk36 | 1 | `f9ba7e06-cdf3-440c-abf9-5f9c29bb4963` | 47.55 |
| Testcase - Regression true app target android16 sdk36 | 2 | `1a2f984f-adcb-47bd-b91b-7eb9fbea3413` | 47.55 |
| Transaction history with tag | 1 | `4ed19e75-8c79-4d28-8a98-d3c497e44216` | 0.33 |
| Verify Device Recommend with "sourceSystem" = TRUEAPP | 1 | `6aa41be2-2d62-43fc-a9bb-fe682d549354` | 3.90 |
| test | 1 | `77a0c2ee-bdc7-4e8b-bd77-79b6000fb674` | 76.33 |
| test | 2 | `d9bbd1cd-e0a1-48b5-80c6-ca8f38548828` | 76.33 |
| test | 3 | `41f7c09e-637b-4c98-a961-2337625819f5` | 76.33 |
| test | 4 | `dc7c4a65-d816-4dee-ae0b-02d52303d06c` | 76.33 |
| test | 5 | `6dfd38c6-bc09-40e8-982c-facf72ef4a1f` | 76.33 |
| test | 6 | `e28eba72-1d4b-4151-beca-31b05d8f477a` | 76.33 |
| test | 7 | `1394462c-bc60-4dc3-a389-f8f4c24276d5` | 76.32 |
| test | 8 | `7fa2d06c-911c-493b-9ae1-30f3e9e6fe41` | 76.33 |
| test | 9 | `12fdd1ab-73c7-4d49-93c6-674e8c1a1a64` | 76.33 |

## Objects ที่ไม่มีทะเบียนและเก่ากว่า 24 ชั่วโมง

| Storage path | MB | อัปเดตล่าสุด (UTC) |
|---|---:|---|
| `4210b86f-fb51-4250-bb80-d971b255e1e0/02091e10-629a-40b4-8674-b248a8fb3d6a/Crosssell_Before_Check_out_domestic_dtac_.xlsx/part-000` | 0.17 | 2026-09-18T07:28:08.792Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-000` | 8.39 | 2026-09-18T04:17:17.683Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-001` | 8.39 | 2026-09-18T04:17:19.759Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-002` | 8.39 | 2026-09-18T04:17:21.288Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-003` | 8.39 | 2026-09-18T04:17:23.803Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-004` | 8.39 | 2026-09-18T04:17:25.756Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-005` | 8.39 | 2026-09-18T04:17:27.295Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-006` | 8.39 | 2026-09-18T04:17:29.774Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-007` | 8.39 | 2026-09-18T04:17:32.458Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-008` | 8.39 | 2026-09-18T04:17:35.585Z |
| `4b3fda84-7ecd-4e89-b6f5-60fba3eab628/ffbf76fb-60c8-4f9c-b75c-e6a54ee298a7/test.xlsx/part-009` | 0.83 | 2026-09-18T04:17:36.064Z |
| `5b7c02be-43f8-4957-bf40-860a8a4dcb93/f821b05f-d8ff-4e5f-aa88-13ca7700d6ef/Regression_TrueApp_preprod_11.1002.0.xlsx/part-000` | 8.39 | 2026-10-20T11:45:29.436Z |
| `5b7c02be-43f8-4957-bf40-860a8a4dcb93/f821b05f-d8ff-4e5f-aa88-13ca7700d6ef/Regression_TrueApp_preprod_11.1002.0.xlsx/part-001` | 8.39 | 2026-10-20T11:45:33.834Z |
| `5b7c02be-43f8-4957-bf40-860a8a4dcb93/f821b05f-d8ff-4e5f-aa88-13ca7700d6ef/Regression_TrueApp_preprod_11.1002.0.xlsx/part-002` | 8.39 | 2026-10-20T11:45:37.355Z |
| `5b7c02be-43f8-4957-bf40-860a8a4dcb93/f821b05f-d8ff-4e5f-aa88-13ca7700d6ef/Regression_TrueApp_preprod_11.1002.0.xlsx/part-003` | 8.39 | 2026-10-20T11:45:40.162Z |
| `5b7c02be-43f8-4957-bf40-860a8a4dcb93/f821b05f-d8ff-4e5f-aa88-13ca7700d6ef/Regression_TrueApp_preprod_11.1002.0.xlsx/part-004` | 3.52 | 2026-10-20T11:45:41.164Z |
| `6b2dce3b-4fb8-496b-9282-c02f8e006490/aba8ee44-5201-42e4-b177-9b2928f02f72/Result_Testing_SUN-3503_Bill_and_Usage_phase_1.xlsx/part-000` | 8.39 | 2026-10-04T11:36:28.889Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-000` | 8.39 | 2026-09-05T09:44:49.748Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-001` | 8.39 | 2026-09-05T09:44:55.300Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-002` | 8.39 | 2026-09-05T09:45:00.205Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-003` | 8.39 | 2026-09-05T09:45:04.915Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-004` | 8.39 | 2026-09-05T09:45:08.731Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-005` | 8.39 | 2026-09-05T09:45:12.992Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-006` | 8.39 | 2026-09-05T09:45:17.599Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-007` | 8.39 | 2026-09-05T09:45:22.996Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-008` | 8.39 | 2026-09-05T09:45:28.056Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/7cd851b5-66a1-4062-bef2-8a3e34c95c75/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-009` | 0.85 | 2026-09-05T09:45:29.481Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-000` | 8.39 | 2026-09-05T09:42:48.169Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-001` | 8.39 | 2026-09-05T09:42:55.065Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-002` | 8.39 | 2026-09-05T09:42:59.664Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-003` | 8.39 | 2026-09-05T09:43:04.181Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-004` | 8.39 | 2026-09-05T09:43:08.386Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-005` | 8.39 | 2026-09-05T09:43:13.304Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-006` | 8.39 | 2026-09-05T09:43:18.023Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-007` | 8.39 | 2026-09-05T09:43:22.449Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-008` | 8.39 | 2026-09-05T09:43:26.618Z |
| `90636b76-3157-4134-b718-a5bbb1e20e18/c84d06c5-2b19-417c-903e-65b579b1ab35/Result_Testcase__UAT_IR_Cross_sell_before_checkout.xlsx/part-009` | 0.85 | 2026-09-05T09:43:27.466Z |
| `b6b71616-999b-47c5-8ac7-c522066fb075/8f0eae34-6d8f-43cb-b369-31511b464d3d/Testcase_-_Regression_true_app_target_android16_sdk36.xlsx/part-000` | 8.39 | 2026-10-01T07:10:54.883Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-000` | 8.39 | 2026-09-18T07:34:50.111Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-001` | 8.39 | 2026-09-18T07:34:51.256Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-002` | 8.39 | 2026-09-18T07:34:52.372Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-003` | 8.39 | 2026-09-18T07:34:53.364Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-004` | 8.39 | 2026-09-18T07:34:54.816Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-005` | 8.39 | 2026-09-18T07:34:56.177Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-006` | 8.39 | 2026-09-18T07:34:57.195Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-007` | 8.39 | 2026-09-18T07:34:58.210Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-008` | 8.39 | 2026-09-18T07:34:59.197Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-009` | 8.39 | 2026-09-18T07:35:00.296Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/03d39f59-af23-460f-a020-0ec32a85c0ef/Bill_Usage.xlsx/part-010` | 4.91 | 2026-09-18T07:35:01.033Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/14a66ec0-6f03-46d6-9a79-6d4d7d790e22/Bill_Usage.xlsx/part-000` | 8.39 | 2026-09-18T16:36:08.753Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-000` | 8.39 | 2026-09-18T07:26:32.805Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-001` | 8.39 | 2026-09-18T07:26:33.716Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-002` | 8.39 | 2026-09-18T07:26:34.847Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-003` | 8.39 | 2026-09-18T07:26:36.025Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-004` | 8.39 | 2026-09-18T07:26:37.136Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-005` | 8.39 | 2026-09-18T07:26:38.250Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-006` | 8.39 | 2026-09-18T07:26:39.559Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-007` | 8.39 | 2026-09-18T07:26:40.771Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-008` | 8.39 | 2026-09-18T07:26:41.973Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-009` | 8.39 | 2026-09-18T07:26:43.295Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/88c4bdb8-e93a-48a4-845b-49f1a243fc18/Bill_Usage.xlsx/part-010` | 4.91 | 2026-09-18T07:26:44.160Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-000` | 8.39 | 2026-09-18T07:37:40.520Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-001` | 8.39 | 2026-09-18T07:37:41.530Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-002` | 8.39 | 2026-09-18T07:37:42.855Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-003` | 8.39 | 2026-09-18T07:37:44.210Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-004` | 8.39 | 2026-09-18T07:37:45.226Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-005` | 8.39 | 2026-09-18T07:37:46.418Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-006` | 8.39 | 2026-09-18T07:37:47.422Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-007` | 8.39 | 2026-09-18T07:37:48.485Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-008` | 8.39 | 2026-09-18T07:37:49.535Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-009` | 8.39 | 2026-09-18T07:37:50.604Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/bb235196-45dd-4133-90a9-6e134d238d99/Bill_Usage.xlsx/part-010` | 4.91 | 2026-09-18T07:37:51.378Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/eb9249c7-756d-4bee-a325-ae7fbc1cf15c/Bill_Usage.xlsx/part-000` | 8.39 | 2026-09-18T10:16:18.453Z |
| `d72a8110-b65c-494e-a2f6-5e90a32bfde8/eb9249c7-756d-4bee-a325-ae7fbc1cf15c/Bill_Usage.xlsx/part-001` | 8.39 | 2026-09-18T10:16:19.854Z |
| `eab1dac1-92cc-40b2-a05a-ae1934858db7/8acc7296-34c2-4dcd-9cb4-20503e6d6d54/QA_-_Preprod_Regression_BE-Preprod-24SEP26_FE-Preprod_11.1001.0.xlsx/part-000` | 0.82 | 2026-10-08T10:28:42.223Z |
| `f345146f-cc1c-462c-b6b1-d1faf6de3d17/880a2a0b-45f8-4b0a-9f2b-10776cfe0ddf/Result_Testcase__UAT_IR_Cross_sell_before_checkout_1_.xlsx/part-000` | 0.01 | 2026-09-05T09:42:33.202Z |
| `f4713ce4-ae75-485f-8281-0ed0c00206a6/32605f8f-c8b8-44cd-b608-bd2a74d56a42/Release_App_Version_11.1002.0_MAR-FE_V2.13.0_.xlsx/part-000` | 8.39 | 2026-10-24T11:23:59.026Z |
| `f4713ce4-ae75-485f-8281-0ed0c00206a6/32605f8f-c8b8-44cd-b608-bd2a74d56a42/Release_App_Version_11.1002.0_MAR-FE_V2.13.0_.xlsx/part-001` | 8.39 | 2026-10-24T11:24:01.137Z |
| `f4713ce4-ae75-485f-8281-0ed0c00206a6/32605f8f-c8b8-44cd-b608-bd2a74d56a42/Release_App_Version_11.1002.0_MAR-FE_V2.13.0_.xlsx/part-002` | 8.39 | 2026-10-24T11:24:03.026Z |
| `f4713ce4-ae75-485f-8281-0ed0c00206a6/32605f8f-c8b8-44cd-b608-bd2a74d56a42/Release_App_Version_11.1002.0_MAR-FE_V2.13.0_.xlsx/part-003` | 8.39 | 2026-10-24T11:24:04.036Z |
| `f4713ce4-ae75-485f-8281-0ed0c00206a6/5cce91d7-e6fb-4f83-8ff1-36523aa84519/Release_App_Version_11.1002.0_MAR-FE_V2.13.0_.xlsx/part-000` | 8.39 | 2026-10-24T17:02:03.785Z |
| `f4713ce4-ae75-485f-8281-0ed0c00206a6/5cce91d7-e6fb-4f83-8ff1-36523aa84519/Release_App_Version_11.1002.0_MAR-FE_V2.13.0_.xlsx/part-001` | 8.39 | 2026-10-24T17:02:07.100Z |
| `f4713ce4-ae75-485f-8281-0ed0c00206a6/e3e26ec3-04f5-4a12-abd8-a1ebe43a13d0/Release_App_Version_11.1002.0_MAR-FE_V2.13.0_.xlsx/part-000` | 8.39 | 2026-10-23T16:13:41.719Z |

## ตรวจหลังดำเนินการ

นับ Storage ผ่าน API จริงล่าสุดได้686,567,594ไบต์ (ประมาณ686.57MB) ต่ำกว่า1GB ไม่พบ object รุ่นเก่าหรือ orphan ที่เข้าเงื่อนไขเหลือในผลสแกนนี้ มีไฟล์รุ่นล่าสุดใหม่เพิ่มประมาณ21.41MBระหว่างทำงาน จึงต่างจากเป้าหมายเดิม665.15MB

ข้อมูลล่าสุดมี38โปรเจค,920แถวเคส และ920แถวผลทดสอบ (มีรายการเพิ่มระหว่างทำงาน) คำสั่ง cleanup ไม่ลบหรือแก้เคส/ผลทดสอบ/Google Sheets/Drive evidence

ค่า Average in period ของหน้า Billing เป็นตัวเลขย้อนหลัง ไม่ใช่ยอดไฟล์ปัจจุบัน จึงอาจยังสูงกว่า1GBหลัง cleanup
