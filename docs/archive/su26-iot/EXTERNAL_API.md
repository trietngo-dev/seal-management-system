# External Team API

API dành cho service-to-service. Tất cả endpoint đều có prefix `/api/external`.

**Base URL:** `https://api-hackathon.lexatek.vn/api`

---

## Xác thực

Mọi request phải gửi kèm header:

```
X-Service-Key: <SERVICE_API_KEY>
```

Giá trị lấy từ biến môi trường `SERVICE_API_KEY` trên server Simulator.

---

## Endpoints

### 1. Tạo đội thi

```
POST /external/teams
```

**Request body:**

```json
{
  "code": "TEAM_A",
  "name": "Đội A",
  "environmentId": "d4e5f6a7-..."
}
```

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `code` | string | ✓ | Mã đội, tối đa 64 ký tự, tự động uppercase |
| `name` | string | ✓ | Tên đội, tối đa 128 ký tự |
| `environmentId` | uuid | ✓ | UUID của Environment (track) |

**Response 200:**

```json
{
  "code": "SUCCESS",
  "message": "Team created",
  "result": {
    "team": {
      "id": "a1b2c3d4-...",
      "code": "TEAM_A",
      "name": "Đội A",
      "environmentId": "d4e5f6a7-...",
      "accessCode": "A1B2C3D4",
      "createdAt": "2026-07-01T07:00:00.000Z"
    },
    "accessCode": "A1B2C3D4",
    "testApiKey": "tk_xxxxxxxxxxxxxxxxxxxxxxxx",
    "judgeApiKey": "jk_xxxxxxxxxxxxxxxxxxxxxxxx",
    "mqttUsername": "TEAM_A",
    "mqttPassword": "mq_xxxxxxxxxxxxxxxx"
  }
}
```

> ⚠️ `testApiKey`, `judgeApiKey`, `mqttPassword` chỉ trả về **một lần duy nhất** khi tạo. Lưu lại ngay.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|---|---|---|
| 409 | `TEAM_CODE_EXISTS` | Code đội đã tồn tại |
| 404 | `ENVIRONMENT_NOT_FOUND` | environmentId không hợp lệ |
| 401 | `INVALID_API_KEY` | Sai hoặc thiếu X-Service-Key |

---

### 2. Danh sách đội thi

```
GET /external/teams
```

Trả về toàn bộ đội thi, sắp xếp theo `createdAt ASC`.

**Response 200:**

```json
{
  "code": "SUCCESS",
  "message": "Success",
  "result": [
    {
      "id": "a1b2c3d4-...",
      "code": "TEAM_A",
      "name": "Đội A",
      "environmentId": "d4e5f6a7-...",
      "accessCode": "A1B2C3D4",
      "createdAt": "2026-07-01T07:00:00.000Z"
    }
  ]
}
```

---

### 3. Lấy credentials theo code đội

```
GET /external/teams/:code/keys
```

| Param | Mô tả |
|---|---|
| `code` | Code đội thi. Không phân biệt hoa/thường. |

**Response 200:**

```json
{
  "code": "SUCCESS",
  "message": "Success",
  "result": {
    "teamCode": "TEAM_A",
    "teamName": "Đội A",
    "testApiKey": "tk_xxxxxxxxxxxxxxxxxxxxxxxx",
    "judgeApiKey": "jk_xxxxxxxxxxxxxxxxxxxxxxxx",
    "testTopic": "hackathon/team_a/test/telemetry",
    "judgeTopic": "hackathon/team_a/judge/telemetry",
    "mqttUsername": "TEAM_A",
    "mqttPassword": "mq_xxxxxxxxxxxxxxxx"
  }
}
```

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|---|---|---|
| 404 | `TEAM_NOT_FOUND` | Không tìm thấy đội |
| 401 | `INVALID_API_KEY` | Sai hoặc thiếu X-Service-Key |

---

## Ví dụ curl

```bash
# Tạo đội
curl -X POST https://api-hackathon.lexatek.vn/api/external/teams \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: your_service_key" \
  -d '{"code":"TEAM_A","name":"Đội A","environmentId":"d4e5f6a7-..."}'

# Danh sách đội
curl https://api-hackathon.lexatek.vn/api/external/teams \
  -H "X-Service-Key: your_service_key"

# Lấy credentials
curl https://api-hackathon.lexatek.vn/api/external/teams/TEAM_A/keys \
  -H "X-Service-Key: your_service_key"
```

---

## Định dạng lỗi

```json
{
  "code": "TEAM_CODE_EXISTS",
  "message": "Team code already exists",
  "result": null
}
```
