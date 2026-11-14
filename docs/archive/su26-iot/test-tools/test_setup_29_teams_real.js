const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('../../server/node_modules/mongoose');
const { Octokit } = require('@octokit/rest');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

// Register Mongoose models
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/events/Round');
require('../../server/features/auth/EventRole');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');
require('../../server/features/github-ai/GithubRepository');
require('../../server/features/github-ai/Commit');
require('../../server/features/github-ai/CommitFile');
require('../../server/features/github-ai/AiAnalysis');
require('../../server/features/grading/Rubric');
require('../../server/features/grading/Criterion');
require('../../server/features/grading/GradingLevel');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// CODE TEMPLATES FOR THE 3 TRACKS
// ==========================================

const CODE_TEMPLATES = {
  HOME: {
    'package.json': JSON.stringify({
      name: 'smart-home-multi-agent-iot',
      version: '1.0.0',
      description: 'Hệ thống Multi-Agent AI × IoT Giám sát và Điều phối Thông minh Smart Home',
      main: 'src/index.js',
      dependencies: {
        '@google/genai': '^0.1.1',
        'express': '^4.19.2',
        'mqtt': '^5.3.5',
        'dotenv': '^16.4.5'
      }
    }, null, 2),
    'README.md': `# Smart Home Multi-Agent AI × IoT System

## 1. Tổng quan Dự án & Persona Mục tiêu
* **Track:** Smart Home & Living (HOME)
* **Persona chính:** Chủ hộ gia đình (Homeowner) - Cần giao diện trực quan, cảnh báo sớm và quyền phê duyệt hành động quan trọng.
* **Persona phụ:** Kỹ thuật viên bảo trì tòa nhà (Building Maintenance Technician).
* **Giá trị cốt lõi:** Tự động giám sát năng lượng, chất lượng không khí, phát hiện sớm nguy cơ sự cố thiết bị và điều phối xử lý tự động có xác nhận của con người.

## 2. Kiến trúc Hệ thống Multi-Agent
Hệ thống triển khai 03 AI Agent chuyên biệt phối hợp qua mô hình Router & Handoff:
1. **CoordinatorAgent:** Tiếp nhận dòng dữ liệu telemetry IoT thời gian thực, định tuyến ngữ cảnh sự cố đến agent chuyên trách.
2. **DiagnosticsAgent:** Phân tích nguyên nhân bất thường từ dữ liệu cảm biến (Nhiệt độ, Độ ẩm, CO2, Công suất điện).
3. **DispatchAgent:** Soạn thảo phương án xử lý, gửi thông báo phê duyệt (Human-in-the-loop) và gọi Tool tạo Work Order.

## 3. Tích hợp IoT & Thiết bị Track Smart Home
* **Topic MQTT Lắng nghe:** \`hackathon/{teamCode}/test/telemetry\` (Tuân thủ nguyên tắc Subscribe 1 chiều từ Broker BTC).
* **Thiết bị tích hợp:**
  - \`AC_01\`: Điều hòa nhiệt độ (power, temperature)
  - \`SENSOR_01\`: Cảm biến môi trường phòng khách (temperature, humidity)
  - \`METER_01\`: Công tơ điện tổng (voltage, current, power)
  - \`CO2_01\`: Cảm biến nồng độ CO2 phòng ngủ (co2)
  - \`HEATER_01\`: Bình nóng lạnh (power, temperature)
  - \`LIGHT_01\`: Cảm biến ánh sáng & chiếu sáng (lux)

## 4. Công cụ Ngoài & Cơ chế Read-Back Verification
* **Tool Tạo Sự cố & Work Order:** \`create_work_order\` kèm \`idempotency_key\` chống trùng lặp khi retry.
* **Read-Back Verification:** Hàm \`verifyWorkOrderCreated()\` tự động đọc lại trạng thái từ hệ thống quản lý sau khi ghi để xác nhận hoàn tất thành công.
* **An toàn & Phê duyệt:** Mọi hành động điều chỉnh thiết bị công suất cao đều yêu cầu Chủ hộ bấm Xác nhận (Approval).
`,
    'src/iot/mqttHomeClient.js': `const mqtt = require('mqtt');

class MqttHomeClient {
  constructor(brokerUrl, teamCode) {
    this.brokerUrl = brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
    this.teamCode = teamCode || process.env.TEAM_CODE || 'team01';
    this.topic = \`hackathon/\${this.teamCode.toLowerCase()}/test/telemetry\`;
    this.client = null;
    this.latestTelemetry = {};
    this.historyWindow = []; // Sliding window 15 mins
  }

  connect(onDataCallback) {
    console.log(\`[MQTT-HOME] Connecting to broker: \${this.brokerUrl}\`);
    this.client = mqtt.connect(this.brokerUrl, {
      reconnectPeriod: 5000,
      connectTimeout: 30000
    });

    this.client.on('connect', () => {
      console.log(\`[MQTT-HOME] Connected successfully. Subscribing to: \${this.topic}\`);
      // Strictly SUBSCRIBE only - Do not publish back to BTC broker
      this.client.subscribe(this.topic, (err) => {
        if (err) console.error('[MQTT-HOME] Subscribe error:', err.message);
      });
    });

    this.client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        this.processTelemetry(payload, onDataCallback);
      } catch (err) {
        console.warn('[MQTT-HOME] Failed to parse telemetry payload:', err.message);
      }
    });

    this.client.on('error', (err) => console.error('[MQTT-HOME] MQTT Error:', err.message));
  }

  processTelemetry(payload, callback) {
    const { devices, timestamp, epoch } = payload;
    if (!Array.isArray(devices)) return;

    devices.forEach(device => {
      this.latestTelemetry[device.deviceCode] = {
        metrics: device.metrics,
        status: device.status,
        updatedAt: new Date(epoch || timestamp || Date.now())
      };
    });

    this.historyWindow.push({ timestamp: new Date(), devices });
    if (this.historyWindow.length > 100) this.historyWindow.shift();

    if (callback) callback(this.latestTelemetry);
  }

  getDeviceMetrics(deviceCode) {
    return this.latestTelemetry[deviceCode] || null;
  }
}

module.exports = MqttHomeClient;
`,
    'src/agents/coordinatorAgent.js': `class CoordinatorAgent {
  constructor(diagnosticsAgent, dispatchAgent) {
    this.diagnosticsAgent = diagnosticsAgent;
    this.dispatchAgent = dispatchAgent;
  }

  async handleTelemetryUpdate(telemetryMap) {
    console.log('[CoordinatorAgent] Receiving real-time telemetry updates...');
    const anomalies = [];

    // Check AC_01 & SENSOR_01 & CO2_01
    const sensor = telemetryMap['SENSOR_01'];
    const co2 = telemetryMap['CO2_01'];
    const meter = telemetryMap['METER_01'];

    if (sensor?.metrics?.temperature > 32) {
      anomalies.push({ device: 'SENSOR_01', type: 'HIGH_TEMP', value: sensor.metrics.temperature });
    }
    if (co2?.metrics?.co2 > 1200) {
      anomalies.push({ device: 'CO2_01', type: 'POOR_AIR_QUALITY', value: co2.metrics.co2 });
    }
    if (meter?.metrics?.power > 4500) {
      anomalies.push({ device: 'METER_01', type: 'POWER_SPIKE', value: meter.metrics.power });
    }

    if (anomalies.length > 0) {
      console.log(\`[CoordinatorAgent] \${anomalies.length} anomaly detected. Handoff context to DiagnosticsAgent...\`);
      const diagnosis = await this.diagnosticsAgent.diagnose(anomalies, telemetryMap);
      
      console.log('[CoordinatorAgent] Diagnosis completed. Handoff to DispatchAgent...');
      return await this.dispatchAgent.dispatchAction(diagnosis);
    }

    return { status: 'NORMAL', message: 'All home sensors within safe baseline.' };
  }
}

module.exports = CoordinatorAgent;
`,
    'src/agents/diagnosticsAgent.js': `class DiagnosticsAgent {
  async diagnose(anomalies, telemetryMap) {
    console.log('[DiagnosticsAgent] Analyzing sensor patterns and root causes...');
    const recommendations = [];

    for (const anomaly of anomalies) {
      if (anomaly.type === 'HIGH_TEMP') {
        recommendations.push({
          targetDevice: 'AC_01',
          action: 'SET_ECO_COOLING',
          rationale: \`Nhiệt độ phòng đạt \${anomaly.value}°C, cao hơn ngưỡng chuẩn 28°C.\`,
          requiresApproval: true,
          urgency: 'MEDIUM'
        });
      } else if (anomaly.type === 'POOR_AIR_QUALITY') {
        recommendations.push({
          targetDevice: 'VENTILATION_FAN',
          action: 'ACTIVATE_FRESH_AIR',
          rationale: \`Nồng độ CO2 \${anomaly.value}ppm vượt ngưỡng an toàn (1000ppm).\`,
          requiresApproval: false,
          urgency: 'HIGH'
        });
      }
    }

    return {
      incidentId: \`INC_\${Date.now()}\`,
      anomalies,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = DiagnosticsAgent;
`,
    'src/agents/dispatchAgent.js': `const { createWorkOrder, verifyWorkOrderCreated } = require('../tools/workOrderTool');

class DispatchAgent {
  async dispatchAction(diagnosis) {
    console.log(\`[DispatchAgent] Processing actions for incident: \${diagnosis.incidentId}\`);
    const results = [];

    for (const rec of diagnosis.recommendations) {
      if (rec.requiresApproval) {
        console.log(\`[DispatchAgent] Action \${rec.action} on \${rec.targetDevice} requires Human Approval from Homeowner.\`);
        results.push({
          device: rec.targetDevice,
          action: rec.action,
          status: 'PENDING_HOMEOWNER_APPROVAL',
          rationale: rec.rationale
        });
      } else {
        console.log(\`[DispatchAgent] Executing automated action: \${rec.action}\`);
        const idempotencyKey = \`ORDER_\${diagnosis.incidentId}_\${rec.targetDevice}\`;
        const order = await createWorkOrder({
          device: rec.targetDevice,
          action: rec.action,
          idempotencyKey
        });

        // Independent Read-Back Verification Step
        const verified = await verifyWorkOrderCreated(order.orderId);
        results.push({
          device: rec.targetDevice,
          action: rec.action,
          status: verified ? 'COMPLETED' : 'VERIFICATION_FAILED',
          orderId: order.orderId,
          verified
        });
      }
    }

    return {
      incidentId: diagnosis.incidentId,
      dispatchedActions: results
    };
  }
}

module.exports = DispatchAgent;
`,
    'src/tools/workOrderTool.js': `const inMemoryOrders = new Map();

async function createWorkOrder({ device, action, idempotencyKey }) {
  if (inMemoryOrders.has(idempotencyKey)) {
    console.log(\`[WorkOrderTool] Idempotent hit: returning existing order for \${idempotencyKey}\`);
    return inMemoryOrders.get(idempotencyKey);
  }

  const order = {
    orderId: \`WO_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`,
    device,
    action,
    createdAt: new Date().toISOString(),
    status: 'ACTIVE'
  };

  inMemoryOrders.set(idempotencyKey, order);
  inMemoryOrders.set(order.orderId, order);
  console.log(\`[WorkOrderTool] Created work order: \${order.orderId} for device \${device}\`);
  return order;
}

async function verifyWorkOrderCreated(orderId) {
  console.log(\`[WorkOrderTool] Running independent read-back verification for order: \${orderId}\`);
  const existing = inMemoryOrders.get(orderId);
  const isValid = existing && existing.status === 'ACTIVE';
  console.log(\`[WorkOrderTool] Verification result for \${orderId}: \${isValid ? 'PASS' : 'FAIL'}\`);
  return Boolean(isValid);
}

module.exports = {
  createWorkOrder,
  verifyWorkOrderCreated
};
`,
    'src/index.js': `const express = require('express');
const MqttHomeClient = require('./iot/mqttHomeClient');
const CoordinatorAgent = require('./agents/coordinatorAgent');
const DiagnosticsAgent = require('./agents/diagnosticsAgent');
const DispatchAgent = require('./agents/dispatchAgent');

const app = express();
app.use(express.json());

const diagnostics = new DiagnosticsAgent();
const dispatch = new DispatchAgent();
const coordinator = new CoordinatorAgent(diagnostics, dispatch);

const mqttClient = new MqttHomeClient();
mqttClient.connect((telemetry) => {
  coordinator.handleTelemetryUpdate(telemetry);
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'HEALTHY', track: 'HOME', devices: mqttClient.latestTelemetry });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`[SMART-HOME] Server running on port \${PORT}\`);
});
`
  },

  FARM: {
    'package.json': JSON.stringify({
      name: 'smart-agriculture-multi-agent-iot',
      version: '1.0.0',
      description: 'Hệ thống Multi-Agent AI × IoT Nông nghiệp Thông minh & Điều tiết Tưới tiêu',
      main: 'src/index.js',
      dependencies: {
        '@google/genai': '^0.1.1',
        'express': '^4.19.2',
        'mqtt': '^5.3.5',
        'dotenv': '^16.4.5'
      }
    }, null, 2),
    'README.md': `# Smart Agriculture Multi-Agent AI × IoT System

## 1. Tổng quan & Persona Mục tiêu
* **Track:** Smart Agriculture (FARM)
* **Persona chính:** Người quản lý nông trại (Farm Manager) - Cần theo dõi tiến độ tưới tiêu, dự báo thời tiết và phê duyệt xả phân bón/thuốc BVTV.
* **Persona phụ:** Kỹ sư nông nghiệp (Agricultural Engineer).
* **Giá trị cốt lõi:** Giám sát độ ẩm đất, nồng độ pH, mức nước bồn chứa và tự động lập lịch tưới tiêu thông minh theo thời tiết.

## 2. Kiến trúc Multi-Agent
1. **FarmCoordinatorAgent:** Định tuyến dữ liệu thời tiết và độ ẩm đất.
2. **IrrigationPlannerAgent:** Tính toán lưu lượng nước và thời gian tưới tối ưu.
3. **CropSafetyAgent:** Giám sát nồng độ pH, nhiệt độ đất và kiểm tra an toàn cây trồng.

## 3. Thiết bị IoT Track Smart Agriculture
* **Topic MQTT Lắng nghe:** \`hackathon/{teamCode}/test/telemetry\` (Subscribe 1 chiều).
* **Thiết bị tích hợp:**
  - \`SOIL_01\`: Cảm biến độ ẩm và nhiệt độ đất (soil_moisture, temperature)
  - \`WEATHER_01\`: Trạm thời tiết (temperature, humidity)
  - \`PUMP_01\`: Máy bơm tưới tiêu (flow_rate, power)
  - \`PH_01\`: Cảm biến độ chua đất/nước (ph)
  - \`TANK_01\`: Cảm biến mực nước bể chứa (level)
  - \`SUN_01\`: Cảm biến cường độ bức xạ mặt trời (lux)

## 4. Verification & Safe Boundaries
* Có read-back verification \`verifyIrrigationSchedule()\` sau khi thiết lập lệnh tưới.
* Bảo vệ an toàn: Kiểm tra mực nước bể \`TANK_01\` trước khi kích hoạt máy bơm \`PUMP_01\`.
`,
    'src/iot/mqttFarmClient.js': `const mqtt = require('mqtt');

class MqttFarmClient {
  constructor(brokerUrl, teamCode) {
    this.brokerUrl = brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
    this.teamCode = teamCode || process.env.TEAM_CODE || 'team01';
    this.topic = \`hackathon/\${this.teamCode.toLowerCase()}/test/telemetry\`;
    this.latestTelemetry = {};
  }

  connect(onDataCallback) {
    this.client = mqtt.connect(this.brokerUrl, { reconnectPeriod: 5000 });
    this.client.on('connect', () => {
      console.log(\`[MQTT-FARM] Connected. Subscribing: \${this.topic}\`);
      this.client.subscribe(this.topic);
    });

    this.client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (Array.isArray(payload.devices)) {
          payload.devices.forEach(d => {
            this.latestTelemetry[d.deviceCode] = {
              metrics: d.metrics,
              updatedAt: new Date()
            };
          });
          if (onDataCallback) onDataCallback(this.latestTelemetry);
        }
      } catch (e) {
        console.warn('[MQTT-FARM] Parse error:', e.message);
      }
    });
  }
}

module.exports = MqttFarmClient;
`,
    'src/agents/farmCoordinatorAgent.js': `class FarmCoordinatorAgent {
  constructor(irrigationPlanner, cropSafety) {
    this.irrigationPlanner = irrigationPlanner;
    this.cropSafety = cropSafety;
  }

  async handleTelemetry(telemetry) {
    const soil = telemetry['SOIL_01'];
    const tank = telemetry['TANK_01'];
    const ph = telemetry['PH_01'];

    console.log('[FarmCoordinatorAgent] Evaluating farm telemetry conditions...');
    
    // Safety check first
    const safetyCheck = await this.cropSafety.checkSafety({ ph, tank });
    if (!safetyCheck.safe) {
      console.warn('[FarmCoordinatorAgent] Safety alert triggered:', safetyCheck.reason);
      return { status: 'BLOCKED_BY_SAFETY', reason: safetyCheck.reason };
    }

    if (soil?.metrics?.soil_moisture < 35) {
      console.log('[FarmCoordinatorAgent] Low soil moisture detected. Handoff to IrrigationPlannerAgent...');
      return await this.irrigationPlanner.planIrrigation({
        currentMoisture: soil.metrics.soil_moisture,
        tankLevel: tank?.metrics?.level || 80
      });
    }

    return { status: 'NORMAL', message: 'Farm moisture in optimal zone.' };
  }
}

module.exports = FarmCoordinatorAgent;
`,
    'src/agents/irrigationPlannerAgent.js': `const { scheduleIrrigation, verifyIrrigationSchedule } = require('../tools/irrigationTool');

class IrrigationPlannerAgent {
  async planIrrigation({ currentMoisture, tankLevel }) {
    console.log(\`[IrrigationPlannerAgent] Planning irrigation. Current moisture: \${currentMoisture}%\`);
    const durationMinutes = Math.round((60 - currentMoisture) * 0.5);
    const idempotencyKey = \`IRR_\${Date.now()}_\${currentMoisture}\`;

    const job = await scheduleIrrigation({
      pumpCode: 'PUMP_01',
      durationMinutes,
      idempotencyKey
    });

    const verified = await verifyIrrigationSchedule(job.jobId);
    return {
      status: verified ? 'SCHEDULED' : 'VERIFY_FAILED',
      durationMinutes,
      jobId: job.jobId,
      verified
    };
  }
}

module.exports = IrrigationPlannerAgent;
`,
    'src/agents/cropSafetyAgent.js': `class CropSafetyAgent {
  async checkSafety({ ph, tank }) {
    if (tank?.metrics?.level < 15) {
      return { safe: false, reason: 'Bể chứa nước TANK_01 dưới 15%, không đủ để kích hoạt máy bơm.' };
    }
    if (ph?.metrics?.ph < 5.5 || ph?.metrics?.ph > 8.0) {
      return { safe: false, reason: \`Độ pH \${ph?.metrics?.ph} ngoài ngưỡng an toàn cho cây trồng (5.5 - 8.0).\` };
    }
    return { safe: true };
  }
}

module.exports = CropSafetyAgent;
`,
    'src/tools/irrigationTool.js': `const scheduledJobs = new Map();

async function scheduleIrrigation({ pumpCode, durationMinutes, idempotencyKey }) {
  if (scheduledJobs.has(idempotencyKey)) {
    return scheduledJobs.get(idempotencyKey);
  }

  const job = {
    jobId: \`IRR_JOB_\${Date.now()}\`,
    pumpCode,
    durationMinutes,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString()
  };

  scheduledJobs.set(idempotencyKey, job);
  scheduledJobs.set(job.jobId, job);
  return job;
}

async function verifyIrrigationSchedule(jobId) {
  console.log(\`[IrrigationTool] Verifying scheduled job: \${jobId}\`);
  const record = scheduledJobs.get(jobId);
  return Boolean(record && record.status === 'CONFIRMED');
}

module.exports = {
  scheduleIrrigation,
  verifyIrrigationSchedule
};
`,
    'src/index.js': `const express = require('express');
const MqttFarmClient = require('./iot/mqttFarmClient');
const FarmCoordinatorAgent = require('./agents/farmCoordinatorAgent');
const IrrigationPlannerAgent = require('./agents/irrigationPlannerAgent');
const CropSafetyAgent = require('./agents/cropSafetyAgent');

const app = express();
app.use(express.json());

const planner = new IrrigationPlannerAgent();
const safety = new CropSafetyAgent();
const coordinator = new FarmCoordinatorAgent(planner, safety);

const mqttClient = new MqttFarmClient();
mqttClient.connect((telemetry) => {
  coordinator.handleTelemetry(telemetry);
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'HEALTHY', track: 'FARM', devices: mqttClient.latestTelemetry });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`[SMART-FARM] Server listening on port \${PORT}\`));
`
  },

  FACTORY: {
    'package.json': JSON.stringify({
      name: 'smart-factory-multi-agent-iot',
      version: '1.0.0',
      description: 'Hệ thống Multi-Agent AI × IoT Bảo trì Dự đoán cho Nhà máy Thông minh',
      main: 'src/index.js',
      dependencies: {
        '@google/genai': '^0.1.1',
        'express': '^4.19.2',
        'mqtt': '^5.3.5',
        'dotenv': '^16.4.5'
      }
    }, null, 2),
    'README.md': `# Smart Factory Multi-Agent AI × IoT System

## 1. Tổng quan & Persona Mục tiêu
* **Track:** Smart Factory & Industrial IoT (FACTORY)
* **Persona chính:** Kỹ sư bảo trì thiết bị nhà xưởng (Maintenance Engineer).
* **Persona phụ:** Quản lý ca sản xuất (Production Shift Supervisor).
* **Giá trị cốt lõi:** Giám sát độ rung, dòng điện, áp suất dây chuyền sản xuất để phát hiện sớm nguy cơ dừng máy (downtime) và tạo phiếu bảo trì dự đoán.

## 2. Kiến trúc Multi-Agent
1. **FactorySupervisorAgent:** Định tuyến dòng dữ liệu cảm biến công nghiệp liên tục.
2. **PredictiveMaintenanceAgent:** Phân tích độ rung và dòng tải của động cơ \`MOTOR_01\` và băng tải \`CONVEYOR_01\`.
3. **IncidentResponderAgent:** Tạo phiếu bảo trì CMMS, phối hợp với Quản lý ca để phê duyệt dừng máy bảo trì.

## 3. Thiết bị IoT Track Smart Factory
* **Topic MQTT Lắng nghe:** \`hackathon/{teamCode}/test/telemetry\` (Subscribe 1 chiều).
* **Thiết bị tích hợp:**
  - \`MOTOR_01\`: Động cơ trục chính (current, vibration, temperature)
  - \`LINE_01\`: Dây chuyền sản xuất tổng (voltage, current)
  - \`CONVEYOR_01\`: Băng chuyền chuyển phôi (speed, load)
  - \`PRESS_01\`: Máy dập thủy lực (pressure)
  - \`GAS_01\`: Cảm biến khí công nghiệp (gas)
  - \`PROBE_01\`: Đầu dò nhiệt độ khuôn (temperature)

## 4. Verification & Idempotency
* Gọi Tool tạo Ticket \`createMaintenanceTicket()\` kèm mã chống trùng \`idempotency_key\`.
* Đọc lại dữ liệu qua \`verifyMaintenanceTicketAccepted()\` để xác thực.
`,
    'src/iot/mqttFactoryClient.js': `const mqtt = require('mqtt');

class MqttFactoryClient {
  constructor(brokerUrl, teamCode) {
    this.brokerUrl = brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
    this.teamCode = teamCode || process.env.TEAM_CODE || 'team01';
    this.topic = \`hackathon/\${this.teamCode.toLowerCase()}/test/telemetry\`;
    this.latestTelemetry = {};
  }

  connect(onDataCallback) {
    this.client = mqtt.connect(this.brokerUrl, { reconnectPeriod: 5000 });
    this.client.on('connect', () => {
      console.log(\`[MQTT-FACTORY] Connected to industrial broker. Subscribing: \${this.topic}\`);
      this.client.subscribe(this.topic);
    });

    this.client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (Array.isArray(payload.devices)) {
          payload.devices.forEach(d => {
            this.latestTelemetry[d.deviceCode] = {
              metrics: d.metrics,
              updatedAt: new Date()
            };
          });
          if (onDataCallback) onDataCallback(this.latestTelemetry);
        }
      } catch (e) {
        console.warn('[MQTT-FACTORY] Parse error:', e.message);
      }
    });
  }
}

module.exports = MqttFactoryClient;
`,
    'src/agents/factorySupervisorAgent.js': `class FactorySupervisorAgent {
  constructor(predictiveAgent, incidentAgent) {
    this.predictiveAgent = predictiveAgent;
    this.incidentAgent = incidentAgent;
  }

  async handleTelemetry(telemetry) {
    const motor = telemetry['MOTOR_01'];
    const conveyor = telemetry['CONVEYOR_01'];
    const press = telemetry['PRESS_01'];

    console.log('[FactorySupervisorAgent] Scanning machine parameters...');
    if (motor?.metrics?.vibration > 4.5 || motor?.metrics?.temperature > 85) {
      console.log('[FactorySupervisorAgent] Motor anomaly detected. Handoff to PredictiveMaintenanceAgent...');
      const analysis = await this.predictiveAgent.analyzeBearingHealth(motor.metrics);
      
      console.log('[FactorySupervisorAgent] Handoff to IncidentResponderAgent...');
      return await this.incidentAgent.handleIncident(analysis);
    }

    return { status: 'NORMAL', message: 'Factory machinery operating smoothly.' };
  }
}

module.exports = FactorySupervisorAgent;
`,
    'src/agents/predictiveMaintenanceAgent.js': `class PredictiveMaintenanceAgent {
  async analyzeBearingHealth(metrics) {
    console.log('[PredictiveMaintenanceAgent] Computing vibration FFT harmonics...');
    return {
      faultType: 'BEARING_WEAR_SUSPECTED',
      severity: metrics.vibration > 6.0 ? 'CRITICAL' : 'WARNING',
      metricsObserved: metrics,
      recommendedAction: 'LUBRICATE_AND_INSPECT_BEARING'
    };
  }
}

module.exports = PredictiveMaintenanceAgent;
`,
    'src/agents/incidentResponderAgent.js': `const { createMaintenanceTicket, verifyMaintenanceTicketAccepted } = require('../tools/maintenanceTool');

class IncidentResponderAgent {
  async handleIncident(analysis) {
    console.log(\`[IncidentResponderAgent] Handling incident: \${analysis.faultType} (Severity: \${analysis.severity})\`);
    const idempotencyKey = \`CMMS_\${Date.now()}_\${analysis.faultType}\`;

    const ticket = await createMaintenanceTicket({
      equipment: 'MOTOR_01',
      fault: analysis.faultType,
      severity: analysis.severity,
      idempotencyKey
    });

    const verified = await verifyMaintenanceTicketAccepted(ticket.ticketId);
    return {
      ticketId: ticket.ticketId,
      status: verified ? 'DISPATCHED_TO_TECHNICIAN' : 'DISPATCH_FAILED',
      verified
    };
  }
}

module.exports = IncidentResponderAgent;
`,
    'src/tools/maintenanceTool.js': `const ticketStore = new Map();

async function createMaintenanceTicket({ equipment, fault, severity, idempotencyKey }) {
  if (ticketStore.has(idempotencyKey)) {
    return ticketStore.get(idempotencyKey);
  }

  const ticket = {
    ticketId: \`TICKET_\${Date.now()}\`,
    equipment,
    fault,
    severity,
    status: 'QUEUED',
    createdAt: new Date().toISOString()
  };

  ticketStore.set(idempotencyKey, ticket);
  ticketStore.set(ticket.ticketId, ticket);
  console.log(\`[MaintenanceTool] Created CMMS Ticket: \${ticket.ticketId}\`);
  return ticket;
}

async function verifyMaintenanceTicketAccepted(ticketId) {
  console.log(\`[MaintenanceTool] Read-back verifying ticket: \${ticketId}\`);
  const record = ticketStore.get(ticketId);
  return Boolean(record && record.status === 'QUEUED');
}

module.exports = {
  createMaintenanceTicket,
  verifyMaintenanceTicketAccepted
};
`,
    'src/index.js': `const express = require('express');
const MqttFactoryClient = require('./iot/mqttFactoryClient');
const FactorySupervisorAgent = require('./agents/factorySupervisorAgent');
const PredictiveMaintenanceAgent = require('./agents/predictiveMaintenanceAgent');
const IncidentResponderAgent = require('./agents/incidentResponderAgent');

const app = express();
app.use(express.json());

const predictive = new PredictiveMaintenanceAgent();
const responder = new IncidentResponderAgent();
const supervisor = new FactorySupervisorAgent(predictive, responder);

const mqttClient = new MqttFactoryClient();
mqttClient.connect((telemetry) => {
  supervisor.handleTelemetry(telemetry);
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'HEALTHY', track: 'FACTORY', devices: mqttClient.latestTelemetry });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`[SMART-FACTORY] Server running on port \${PORT}\`));
`
  }
};

// ==========================================
// MAIN SETUP LOGIC FOR 29 TEAMS
// ==========================================

async function setup29TeamsRealContest() {
  console.log('================================================================');
  console.log(' KHỞI TẠO CUỘC THI THỰC TẾ: 29 ĐỘI THI - 3 TRACKS - 29 REPOS GITHUB');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`[1/5] Kết nối MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('  -> Đã kết nối MongoDB thành công.');

  const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const orgName = process.env.GITHUB_ORGANIZATION || 'sealhackathon-2026';

  if (!githubToken) {
    console.error('[ERROR] GITHUB_PERSONAL_ACCESS_TOKEN chưa được cấu hình trong server/.env');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: githubToken });
  console.log(`[2/5] GitHub Organization mục tiêu: ${orgName}`);

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Round = mongoose.model('Round');
  const Track = mongoose.model('Track');
  const EventRole = mongoose.model('EventRole');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const GithubRepository = mongoose.model('GithubRepository');
  const Rubric = mongoose.model('Rubric');
  const Criterion = mongoose.model('Criterion');

  const eventName = 'Hackathon Multi-Agent AI x IoT 2026 - Official Qualifier';

  // Dọn dẹp event cũ nếu có cùng tên
  console.log(`\n[3/5] Dọn dẹp dữ liệu cũ của sự kiện "${eventName}"...`);
  const oldEvents = await Event.find({ name: eventName });
  for (const oldEvent of oldEvents) {
    const eventId = oldEvent._id;
    const oldTeams = await Team.find({ eventId });
    const teamIds = oldTeams.map(t => t._id);

    await Rubric.deleteMany({ eventId });
    await Criterion.deleteMany({ rubricId: { $in: await Rubric.find({ eventId }).select('_id') } });
    await GithubRepository.deleteMany({ eventId });
    await TeamMember.deleteMany({ teamId: { $in: teamIds } });
    await EventRole.deleteMany({ eventId });
    await Team.deleteMany({ eventId });
    await Track.deleteMany({ eventId });
    await Round.deleteMany({ eventId });
    await Event.deleteOne({ _id: eventId });
  }

  // Khởi tạo Event
  const event = new Event({
    name: eventName,
    semester: 'Summer',
    year: 2026,
    status: 'ongoing', // Sẵn sàng để chấm thi & sync cron
    description: 'Cuộc thi Hackathon Multi-Agent AI x IoT 2026 Vòng Sơ Khảo 29 Đội Thi.',
    githubOrgName: orgName,
    commitSyncInterval: 30
  });
  await event.save();
  console.log(`  -> Đã tạo Event: "${event.name}" (ID: ${event._id})`);

  // Khởi tạo Vòng Sơ Khảo (Round 1)
  const round1 = new Round({
    eventId: event._id,
    name: 'Vòng sơ khảo',
    order: 1,
    status: 'active',
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 7),
    advanceTopN: 5
  });
  await round1.save();
  console.log(`  -> Đã tạo Vòng thi: "${round1.name}"`);

  // Khởi tạo Rubric Vòng 1 với 5 tiêu chí chuẩn
  const rubric1 = new Rubric({
    name: 'Rubric Vòng sơ khảo Multi-Agent AI x IoT',
    eventId: event._id,
    roundId: round1._id,
    isActive: true,
    description: 'Bộ tiêu chí đánh giá chuẩn cho Vòng sơ khảo.'
  });
  await rubric1.save();

  const criteriaData = [
    { code: 'R1_01', name: 'MQTT/IoT như nguồn quan sát và ngữ cảnh quyết định', maxScore: 5, weight: 20, order: 1 },
    { code: 'R1_02', name: 'Phối hợp Multi-Agent — vai trò và handoff', maxScore: 5, weight: 20, order: 2 },
    { code: 'R1_03', name: 'Tool/API bên ngoài và verification', maxScore: 5, weight: 20, order: 3 },
    { code: 'R1_04', name: 'Phù hợp Domain, UX và human approval', maxScore: 5, weight: 20, order: 4 },
    { code: 'R1_05', name: 'Sáng tạo, giá trị sản phẩm và Demo', maxScore: 5, weight: 20, order: 5 }
  ];

  const defaultGradingLevels = [
    { label: 'Xuất sắc', minScore: 4.5, maxScore: 5.0, description: 'Đạt tối đa các yêu cầu và có tính sáng tạo cao.' },
    { label: 'Tốt', minScore: 3.5, maxScore: 4.4, description: 'Hoàn thành tốt toàn bộ các tiêu chí cơ bản.' },
    { label: 'Khá', minScore: 2.5, maxScore: 3.4, description: 'Đáp ứng được phần lớn các yêu cầu.' },
    { label: 'Trung bình', minScore: 1.5, maxScore: 2.4, description: 'Chỉ hoàn thành được một phần nhỏ yêu cầu.' },
    { label: 'Yếu', minScore: 0.0, maxScore: 1.4, description: 'Chưa đạt yêu cầu tối thiểu.' }
  ];

  for (const c of criteriaData) {
    await new Criterion({
      rubricId: rubric1._id,
      code: c.code,
      name: c.name,
      maxScore: c.maxScore,
      weight: c.weight,
      order: c.order,
      gradingLevels: defaultGradingLevels,
      description: `Đánh giá tiêu chí ${c.name}`
    }).save();
  }
  console.log(`  -> Đã tạo Rubric và 5 Tiêu chí chấm điểm.`);

  // Khởi tạo 3 Track: HOME, FARM, FACTORY
  const trackHome = new Track({ eventId: event._id, roundId: round1._id, name: 'HOME', maxTeams: 10, advanceTopN: 3 });
  await trackHome.save();

  const trackFarm = new Track({ eventId: event._id, roundId: round1._id, name: 'FARM', maxTeams: 10, advanceTopN: 3 });
  await trackFarm.save();

  const trackFactory = new Track({ eventId: event._id, roundId: round1._id, name: 'FACTORY', maxTeams: 10, advanceTopN: 3 });
  await trackFactory.save();
  console.log(`  -> Đã tạo 3 Track: HOME (10 đội), FARM (10 đội), FACTORY (9 đội).`);

  // Cấu hình phân bổ 29 đội thi
  const teamsDistribution = [
    { trackKey: 'HOME', trackDoc: trackHome, count: 10, prefix: 'home' },
    { trackKey: 'FARM', trackDoc: trackFarm, count: 10, prefix: 'farm' },
    { trackKey: 'FACTORY', trackDoc: trackFactory, count: 9, prefix: 'factory' }
  ];

  console.log(`\n[4/5] Khởi tạo 29 Đội thi & Tạo 29 GitHub Repositories thật trên Organization...`);

  // Helper hàm đẩy file lên GitHub
  async function pushFileToGitHub(owner, repo, filename, content, commitMessage) {
    let sha = undefined;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: filename });
      sha = data.sha;
    } catch (e) {}

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filename,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch: 'main'
    });
  }

  let globalTeamIndex = 1;
  const createdReposList = [];

  for (const group of teamsDistribution) {
    const { trackKey, trackDoc, count, prefix } = group;
    console.log(`\n--- Đang xử lý Bảng ${trackKey} (${count} đội) ---`);

    for (let i = 1; i <= count; i++) {
      const numStr = String(i).padStart(2, '0');
      const teamCode = `team-${prefix}-${numStr}`;
      const teamName = `Team ${trackKey} ${numStr}`;
      const repoName = `team-${prefix}-${numStr}`;
      const leaderEmail = `leader-${prefix}-${numStr}@example.com`;

      console.log(`\n[Đội ${globalTeamIndex}/29] ${teamName} (${teamCode})`);

      // 1. Tạo User Leader
      let leader = await User.findOne({ email: leaderEmail });
      if (!leader) {
        leader = new User({
          email: leaderEmail,
          fullName: `Leader ${teamName}`,
          passwordHash: '$2a$10$T8Z.G6B.c0n.gD.u0o.nG.hB.z7b8v9u10y11z12a13b14c15d16e',
          isApproved: true,
          isActive: true,
          studentId: `SE${180000 + globalTeamIndex}`,
          university: 'FPT University'
        });
        await leader.save();
      }

      // 2. Tạo Team
      const team = new Team({
        eventId: event._id,
        leaderId: leader._id,
        name: teamName,
        status: 'confirmed',
        trackId: trackDoc._id,
        currentRoundId: round1._id
      });
      await team.save();

      // 3. Tạo TeamMember & EventRole
      await new TeamMember({
        teamId: team._id,
        eventId: event._id,
        userId: leader._id,
        role: 'leader',
        confirmStatus: 'confirmed',
        confirmedAt: new Date()
      }).save();

      await new EventRole({
        userId: leader._id,
        eventId: event._id,
        role: 'participant',
        status: 'active'
      }).save();

      // 4. Kiểm tra hoặc Tạo GitHub Repository trên Org
      let githubRepoData = null;
      try {
        const { data } = await octokit.repos.get({ owner: orgName, repo: repoName });
        console.log(`  + GitHub repo "${orgName}/${repoName}" đã tồn tại.`);
        githubRepoData = data;
      } catch (err) {
        if (err.status === 404) {
          console.log(`  + Đang tạo mới repo trên GitHub: "${orgName}/${repoName}"...`);
          const { data } = await octokit.repos.createInOrg({
            org: orgName,
            name: repoName,
            description: `Mã nguồn dự án ${teamName} - Track ${trackKey} - Hackathon Multi-Agent AI x IoT 2026`,
            private: false,
            auto_init: true
          });
          githubRepoData = data;
          await sleep(1500); // Chờ GitHub khởi tạo branch main
        } else {
          console.error(`  - Lỗi khi kiểm tra GitHub repo:`, err.message);
        }
      }

      // 5. Đẩy Mã Nguồn Hoàn Chỉnh cho Track lên Repo
      console.log(`  + Đang đẩy bộ mã nguồn mẫu Track ${trackKey} lên repo...`);
      const template = CODE_TEMPLATES[trackKey];
      for (const [filePath, fileContent] of Object.entries(template)) {
        try {
          await pushFileToGitHub(orgName, repoName, filePath, fileContent, `feat: Hoàn thiện module ${filePath} cho ${teamName}`);
        } catch (pushErr) {
          console.warn(`    ! Cảnh báo khi push ${filePath}:`, pushErr.message);
        }
      }

      // 6. Lưu GithubRepository vào MongoDB
      const repoUrl = `https://github.com/${orgName}/${repoName}`;
      const repoRecord = new GithubRepository({
        eventId: event._id,
        trackId: trackDoc._id,
        teamId: team._id,
        orgName,
        repoName,
        repoUrl,
        githubRepoId: String(githubRepoData?.id || Date.now()),
        syncStatus: 'not_synced',
        lastSyncedAt: null,
        isArchived: false
      });
      await repoRecord.save();

      createdReposList.push({
        index: globalTeamIndex,
        teamName,
        track: trackKey,
        repoUrl,
        repoId: repoRecord._id
      });

      globalTeamIndex++;
      await sleep(1000); // Delay tránh rate limit GitHub API
    }
  }

  console.log('\n================================================================');
  console.log(' [5/5] HOÀN TẤT THÀNH CÔNG KHỞI TẠO 29 ĐỘI VÀ 29 REPOSITORIES!');
  console.log('================================================================');
  console.table(createdReposList.map(r => ({
    STT: r.index,
    'Tên Đội': r.teamName,
    'Track': r.track,
    'GitHub Repository': r.repoUrl
  })));

  console.log(`\nTổng số đội thi đã tạo: ${createdReposList.length} đội.`);
  console.log('Sự kiện:', eventName);
  console.log('Trạng thái: Sẵn sàng cho việc trigger Cron Commit Sync từ giao diện Web/API.');
  
  await mongoose.disconnect();
}

setup29TeamsRealContest().catch(err => {
  console.error('[FATAL ERROR] Khởi tạo thất bại:', err);
  process.exit(1);
});
