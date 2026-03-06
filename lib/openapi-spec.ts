export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Precheck API",
    version: "1.0.0",
    description: "预申请系统 API 文档",
  },
  servers: [{ url: "/api", description: "API Server" }],
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        description: "API Token (pk_...)",
      },
      cookieAuth: {
        type: "apiKey" as const,
        in: "cookie" as const,
        name: "session_token",
      },
    },
  },
  tags: [
    { name: "Auth", description: "认证相关" },
    { name: "Admin", description: "管理员接口" },
    { name: "Dashboard", description: "用户控制台" },
    { name: "PreApplication", description: "预申请" },
    { name: "Public", description: "公开接口" },
    { name: "Tickets", description: "工单系统" },
    { name: "Chat", description: "工单消息" },
  ],
  paths: {
    // ── Auth ──
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "登录",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "登录成功" },
          "401": { description: "凭据无效" },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "注册新用户",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "注册成功" },
          "400": { description: "参数错误" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "登出",
        responses: {
          "200": { description: "登出成功" },
        },
      },
    },
    "/auth/session": {
      get: {
        tags: ["Auth"],
        summary: "获取当前会话",
        responses: {
          "200": { description: "会话信息" },
          "401": { description: "未登录" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "获取当前用户信息",
        responses: {
          "200": { description: "用户信息" },
          "401": { description: "未登录" },
        },
      },
    },

    // ── Admin ──
    "/admin/pre-applications": {
      get: {
        tags: ["Admin"],
        summary: "预申请列表",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
            description:
              "状态筛选，支持逗号分隔多个值：PENDING,DISPUTED,PENDING_REVIEW,ON_HOLD,APPROVED,REJECTED,ARCHIVED,SHADOW_HIDDEN",
          },
          { name: "registerEmail", in: "query", schema: { type: "string" } },
          { name: "queryToken", in: "query", schema: { type: "string" } },
          { name: "fingerprintHash", in: "query", schema: { type: "string" } },
          { name: "reviewRound", in: "query", schema: { type: "integer", minimum: 1 } },
          {
            name: "inviteStatus",
            in: "query",
            schema: { type: "string", enum: ["issued", "none"] },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          {
            name: "sortBy",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "createdAt",
                "updatedAt",
                "status",
                "registerEmail",
                "resubmitCount",
                "inviteCodeId",
                "codeSent",
              ],
              default: "createdAt",
            },
            description: "按 createdAt 排序时，实际按最新版本时间（latestVersionCreatedAt）排序",
          },
          {
            name: "sortOrder",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
        ],
        responses: {
          "200": {
            description: "预申请列表",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    records: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          status: { type: "string" },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" },
                          latestVersionCreatedAt: { type: "string", format: "date-time" },
                          reviewRound: { type: "integer" },
                        },
                      },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    stats: {
                      type: "object",
                      properties: {
                        pending: { type: "integer" },
                        approved: { type: "integer" },
                        rejected: { type: "integer" },
                        disputed: { type: "integer" },
                        archived: { type: "integer" },
                        shadowHidden: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "503": { description: "数据库未配置" },
        },
      },
    },
    "/admin/pre-applications/{id}/review": {
      post: {
        tags: ["Admin"],
        summary: "审核预申请",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action", "guidance"],
                properties: {
                  action: {
                    type: "string",
                    enum: ["APPROVE", "REJECT", "DISPUTE", "PENDING_REVIEW", "ON_HOLD"],
                  },
                  guidance: { type: "string", minLength: 1, maxLength: 2000 },
                  inviteCode: { type: "string" },
                  inviteExpiresAt: { type: "string", format: "date-time" },
                  codeSent: { type: "boolean" },
                  locale: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "审核完成（可能包含 emailSent/emailError）" },
          "400": { description: "参数错误或状态不允许审核" },
          "401": { description: "未认证" },
          "403": { description: "无权限（仅 ADMIN 可审核）" },
          "404": { description: "申请不存在" },
          "409": { description: "Shadowban 锁定，禁止修改" },
          "503": { description: "数据库未配置" },
        },
      },
    },
    "/admin/pre-application-appeals": {
      get: {
        tags: ["Admin"],
        summary: "预申请申诉队列",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
            description: "状态筛选，支持逗号分隔多个值：PENDING,REJECTED,OVERRIDDEN；默认 PENDING",
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "预申请申诉列表",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    records: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          preApplicationId: { type: "string" },
                          userId: { type: "string" },
                          status: {
                            type: "string",
                            enum: ["PENDING", "REJECTED", "OVERRIDDEN"],
                          },
                          reason: { type: "string" },
                          reviewComment: { type: "string", nullable: true },
                          reviewedAt: { type: "string", format: "date-time", nullable: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    stats: {
                      type: "object",
                      properties: {
                        pending: { type: "integer" },
                        rejected: { type: "integer" },
                        overridden: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "未认证" },
          "403": { description: "无权限（仅 SUPER_ADMIN）" },
          "503": { description: "数据库未配置" },
        },
      },
    },
    "/admin/pre-application-appeals/{id}/review": {
      post: {
        tags: ["Admin"],
        summary: "审核预申请申诉",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action", "reviewComment"],
                properties: {
                  action: { type: "string", enum: ["REJECT", "APPROVE"] },
                  reviewComment: { type: "string", minLength: 1, maxLength: 2000 },
                  locale: { type: "string", enum: ["en", "zh"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "审核完成" },
          "400": { description: "参数错误或审核动作无效" },
          "401": { description: "未认证" },
          "403": { description: "无权限（仅 SUPER_ADMIN）" },
          "404": { description: "申诉不存在" },
          "409": { description: "申诉已处理或关联预申请状态已变化" },
          "503": { description: "数据库未配置" },
        },
      },
    },
    "/admin/pre-applications/{id}/notes": {
      get: {
        tags: ["Admin"],
        summary: "获取预申请管理员备注",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "备注列表" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "申请不存在" },
          "503": { description: "数据库未配置" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "创建预申请管理员备注",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", minLength: 1, maxLength: 2000 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "创建成功" },
          "400": { description: "参数错误" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "申请不存在" },
          "503": { description: "数据库未配置" },
        },
      },
    },
    "/admin/pre-applications/{id}/notes/{noteId}": {
      patch: {
        tags: ["Admin"],
        summary: "更新预申请管理员备注",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "noteId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", minLength: 1, maxLength: 2000 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新成功" },
          "400": { description: "参数错误" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "备注不存在" },
          "409": { description: "备注已删除" },
          "503": { description: "数据库未配置" },
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "删除预申请管理员备注（软删除）",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "noteId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "删除成功" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "备注不存在" },
          "409": { description: "备注已删除" },
          "503": { description: "数据库未配置" },
        },
      },
    },
    "/admin/risk-control/fingerprint-groups": {
      get: {
        tags: ["Admin"],
        summary: "获取指纹风险分组",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "search", in: "query", schema: { type: "string" } },
          {
            name: "riskLevel",
            in: "query",
            schema: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          },
          {
            name: "sortBy",
            in: "query",
            schema: { type: "string", enum: ["userCount", "applicationCount", "lastSeenAt"] },
          },
          { name: "sortOrder", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
        ],
        responses: {
          "200": { description: "风险分组列表" },
          "403": { description: "无权限" },
        },
      },
    },
    "/admin/risk-control/fingerprint-groups/{fingerprintHash}": {
      get: {
        tags: ["Admin"],
        summary: "获取指纹风险分组详情",
        parameters: [
          { name: "fingerprintHash", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "风险分组详情" },
          "404": { description: "未找到" },
        },
      },
    },
    "/admin/risk-control/ignored-users": {
      get: {
        tags: ["Admin"],
        summary: "获取风险忽略用户列表",
        responses: {
          "200": { description: "忽略用户列表" },
          "403": { description: "无权限" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "新增/更新风险忽略用户",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "reason"],
                properties: {
                  userId: { type: "string" },
                  reason: { type: "string", minLength: 5 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "保存成功" },
          "400": { description: "参数错误" },
          "403": { description: "无权限" },
        },
      },
    },
    "/admin/risk-control/ignored-users/{userId}": {
      delete: {
        tags: ["Admin"],
        summary: "删除风险忽略用户",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "删除成功" },
          "404": { description: "未找到" },
        },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "用户列表（仅超级管理员）",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          {
            name: "sortBy",
            in: "query",
            schema: { type: "string", enum: ["createdAt", "email", "name", "role", "status"] },
          },
          { name: "sortOrder", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          {
            name: "role",
            in: "query",
            schema: { type: "string", enum: ["all", "USER", "ADMIN", "SUPER_ADMIN"] },
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["all", "ACTIVE", "INACTIVE", "BANNED", "DELETED"] },
          },
          { name: "provider", in: "query", schema: { type: "string" } },
          { name: "linuxdoTL3", in: "query", schema: { type: "boolean" } },
          { name: "fingerprintHash", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "用户列表",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          email: { type: "string", format: "email" },
                          name: { type: "string", nullable: true },
                          role: { type: "string" },
                          status: { type: "string" },
                          banReason: { type: "string", nullable: true },
                          preApplicationSubmitBannedUntil: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                          createdAt: { type: "string", format: "date-time" },
                          latestFingerprintHash: { type: "string", nullable: true },
                          latestFingerprintAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                          applicationCount: { type: "integer" },
                          reviewCount: { type: "integer" },
                          shadowBanned: { type: "boolean" },
                          shadowBanReason: { type: "string", nullable: true },
                          shadowBannedAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                        },
                      },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    stats: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        admins: { type: "integer" },
                        active: { type: "integer" },
                        banned: { type: "integer" },
                        linuxdo: { type: "integer" },
                        linuxdoTL3Admins: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "503": { description: "数据库未配置" },
          "500": { description: "服务器错误" },
        },
      },
    },
    "/admin/users/{id}": {
      get: {
        tags: ["Admin"],
        summary: "获取单个用户（仅超级管理员）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "用户详情",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string", format: "email" },
                    name: { type: "string", nullable: true },
                    role: { type: "string" },
                    status: { type: "string" },
                    banReason: { type: "string", nullable: true },
                    preApplicationSubmitBannedUntil: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "用户不存在" },
          "503": { description: "数据库未配置" },
          "500": { description: "服务器错误" },
        },
      },
      put: {
        tags: ["Admin"],
        summary: "更新用户（仅超级管理员）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["USER", "ADMIN", "SUPER_ADMIN"] },
                  status: { type: "string", enum: ["ACTIVE", "INACTIVE", "BANNED"] },
                  banReason: { type: "string", maxLength: 500, nullable: true },
                  preApplicationSubmitBanDays: {
                    type: "integer",
                    minimum: 1,
                    maximum: 3650,
                    nullable: true,
                    description: "提交封禁天数（24h 滚动）；null 表示解除提交封禁",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新成功" },
          "400": { description: "参数错误" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "用户不存在" },
          "503": { description: "数据库未配置" },
          "500": { description: "服务器错误" },
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "删除用户（仅超级管理员）",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "hard",
            in: "query",
            schema: { type: "boolean" },
            description: "true 时彻底删除；否则软删除为 DELETED 状态",
          },
        ],
        responses: {
          "200": { description: "删除成功" },
          "400": { description: "参数错误（如不能删除自己）" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "用户不存在" },
          "503": { description: "数据库未配置" },
          "500": { description: "服务器错误" },
        },
      },
    },
    "/admin/users/export": {
      get: {
        tags: ["Admin"],
        summary: "导出用户列表 CSV（仅超级管理员）",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "role", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "provider", in: "query", schema: { type: "string" } },
          { name: "linuxdoTL3", in: "query", schema: { type: "boolean" } },
          { name: "fingerprintHash", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "CSV 文件",
            content: {
              "text/csv": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "503": { description: "数据库未配置" },
          "500": { description: "服务器错误" },
        },
      },
    },
    "/admin/users/batch-role": {
      post: {
        tags: ["Admin"],
        summary: "批量更新用户角色（仅超级管理员）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userIds", "role"],
                properties: {
                  userIds: { type: "array", minItems: 1, maxItems: 100, items: { type: "string" } },
                  role: { type: "string", enum: ["USER", "ADMIN"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新结果" },
          "400": { description: "参数错误" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "503": { description: "数据库未配置" },
          "500": { description: "服务器错误" },
        },
      },
    },
    "/admin/users/batch-create": {
      post: {
        tags: ["Admin"],
        summary: "批量创建用户（仅超级管理员）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["emails"],
                properties: {
                  emails: {
                    type: "array",
                    minItems: 1,
                    maxItems: 100,
                    items: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "创建结果" },
          "400": { description: "参数错误" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "503": { description: "数据库未配置" },
          "500": { description: "服务器错误" },
        },
      },
    },
    "/admin/messages": {
      get: {
        tags: ["Admin"],
        summary: "站内信列表",
        responses: {
          "200": { description: "消息列表" },
          "403": { description: "无权限" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "创建站内信",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "content"],
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  recipientIds: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "创建成功" },
          "400": { description: "参数错误" },
        },
      },
    },
    "/admin/messages/{id}": {
      put: {
        tags: ["Admin"],
        summary: "更新站内信",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新成功" },
          "404": { description: "消息不存在" },
        },
      },
    },
    "/admin/messages/{id}/revoke": {
      post: {
        tags: ["Admin"],
        summary: "撤回站内信",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "撤回成功" },
          "404": { description: "消息不存在" },
        },
      },
    },
    "/admin/invite-codes": {
      get: {
        tags: ["Admin"],
        summary: "邀请码列表",
        responses: {
          "200": { description: "邀请码列表" },
          "403": { description: "无权限" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "创建/导入邀请码",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  codes: { type: "array", items: { type: "string" } },
                  count: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "创建成功" },
          "400": { description: "参数错误" },
        },
      },
    },
    "/admin/settings": {
      get: {
        tags: ["Admin"],
        summary: "获取站点设置",
        responses: {
          "200": { description: "站点设置" },
          "403": { description: "无权限" },
        },
      },
      put: {
        tags: ["Admin"],
        summary: "更新站点设置",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        responses: {
          "200": { description: "更新成功" },
          "400": { description: "参数错误" },
        },
      },
    },
    "/admin/system-config": {
      get: {
        tags: ["Admin"],
        summary: "获取系统配置",
        responses: {
          "200": {
            description: "系统配置",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    preApplicationEssayHint: { type: "string" },
                    preApplicationEssayMinLength: { type: "integer" },
                    preApplicationEssayMaxLength: { type: "integer" },
                    preApplicationDailyGlobalLimit: { type: "integer" },
                    preApplicationDailyUserLimit: { type: "integer" },
                    preApplicationSubmitStartTime: {
                      type: "string",
                      description: "HH:mm，Asia/Shanghai",
                    },
                    preApplicationSubmitEndTime: {
                      type: "string",
                      description: "HH:mm，Asia/Shanghai",
                    },
                    maxResubmitCount: { type: "integer" },
                  },
                },
              },
            },
          },
          "403": { description: "无权限" },
        },
      },
      put: {
        tags: ["Admin"],
        summary: "更新系统配置",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  preApplicationEssayHint: { type: "string" },
                  preApplicationEssayMinLength: { type: "integer" },
                  preApplicationEssayMaxLength: { type: "integer" },
                  preApplicationDailyGlobalLimit: { type: "integer", minimum: 1 },
                  preApplicationDailyUserLimit: { type: "integer", minimum: 1 },
                  preApplicationSubmitStartTime: {
                    type: "string",
                    pattern: "^([01]\\\\d|2[0-3]):([0-5]\\\\d)$",
                  },
                  preApplicationSubmitEndTime: {
                    type: "string",
                    pattern: "^([01]\\\\d|2[0-3]):([0-5]\\\\d)$",
                  },
                  maxResubmitCount: { type: "integer", minimum: 0 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新成功" },
          "400": { description: "参数错误" },
        },
      },
    },
    "/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "控制台统计数据",
        responses: {
          "200": { description: "统计数据" },
          "403": { description: "无权限" },
        },
      },
    },
    "/admin/api-tokens": {
      get: {
        tags: ["Admin"],
        summary: "API Token 列表",
        responses: {
          "200": { description: "Token 列表" },
          "403": { description: "无权限" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "创建 API Token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "创建成功" },
          "400": { description: "参数错误" },
        },
      },
    },
    "/admin/api-tokens/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "撤销 API Token",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "撤销成功" },
          "404": { description: "Token 不存在" },
        },
      },
    },
    "/admin/audit-logs": {
      get: {
        tags: ["Admin"],
        summary: "审计日志列表",
        responses: {
          "200": { description: "审计日志" },
          "403": { description: "无权限" },
        },
      },
    },
    "/admin/email-logs": {
      get: {
        tags: ["Admin"],
        summary: "邮件日志列表",
        responses: {
          "200": { description: "邮件日志" },
          "403": { description: "无权限" },
        },
      },
    },

    // ── Dashboard ──
    "/dashboard/profile": {
      put: {
        tags: ["Dashboard"],
        summary: "更新个人资料",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  avatar: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新成功" },
          "401": { description: "未认证" },
        },
      },
    },
    "/dashboard/password": {
      put: {
        tags: ["Dashboard"],
        summary: "修改密码",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["oldPassword", "newPassword"],
                properties: {
                  oldPassword: { type: "string" },
                  newPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "修改成功" },
          "400": { description: "旧密码错误" },
        },
      },
    },
    "/dashboard/messages": {
      get: {
        tags: ["Dashboard"],
        summary: "用户站内信列表",
        responses: {
          "200": { description: "消息列表" },
          "401": { description: "未认证" },
        },
      },
    },
    "/dashboard/messages/summary": {
      get: {
        tags: ["Dashboard"],
        summary: "未读消息数",
        responses: {
          "200": { description: "未读数量" },
          "401": { description: "未认证" },
        },
      },
    },
    "/dashboard/messages/{id}/read": {
      put: {
        tags: ["Dashboard"],
        summary: "标记已读",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "标记成功" },
          "404": { description: "消息不存在" },
        },
      },
    },

    // ── PreApplication ──
    "/pre-application": {
      get: {
        tags: ["PreApplication"],
        summary: "获取当前用户的预申请记录",
        responses: {
          "200": {
            description: "预申请记录列表",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    records: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          essay: { type: "string" },
                          source: {
                            type: "string",
                            enum: ["TIEBA", "BILIBILI", "DOUYIN", "XIAOHONGSHU", "OTHER"],
                            nullable: true,
                          },
                          sourceDetail: { type: "string", nullable: true },
                          registerEmail: { type: "string" },
                          group: { type: "string" },
                          status: {
                            type: "string",
                            enum: [
                              "PENDING",
                              "APPROVED",
                              "REJECTED",
                              "DISPUTED",
                              "ARCHIVED",
                              "PENDING_REVIEW",
                              "ON_HOLD",
                            ],
                          },
                          guidance: { type: "string", nullable: true },
                          resubmitCount: { type: "integer" },
                          version: { type: "integer" },
                          queryToken: { type: "string", nullable: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                    latest: { type: "object", nullable: true },
                    maxResubmitCount: { type: "integer" },
                    queueInfo: { type: "object", nullable: true },
                    submitQuotaStatus: {
                      type: "object",
                      nullable: true,
                      properties: {
                        dailyGlobalLimit: { type: "integer" },
                        dailyUserLimit: { type: "integer" },
                        submitStartTime: { type: "string" },
                        submitEndTime: { type: "string" },
                        isWithinSubmitWindow: { type: "boolean" },
                        quotaServiceAvailable: { type: "boolean" },
                        userUsedToday: { type: "integer", nullable: true },
                        userRemainingToday: { type: "integer", nullable: true },
                        globalUsedToday: { type: "integer", nullable: true },
                        globalRemainingToday: { type: "integer", nullable: true },
                      },
                    },
                    submitBanStatus: {
                      type: "object",
                      nullable: true,
                      properties: {
                        isSubmitBanned: { type: "boolean" },
                        submitBannedUntil: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        remainingSeconds: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "未认证" },
        },
      },
      post: {
        tags: ["PreApplication"],
        summary: "提交预申请（按 Asia/Shanghai 时段与每日限额控制）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["essay", "registerEmail", "group"],
                properties: {
                  essay: {
                    type: "string",
                    minLength: 50,
                    maxLength: 300,
                    description: "申请理由",
                  },
                  source: {
                    type: "string",
                    enum: ["TIEBA", "BILIBILI", "DOUYIN", "XIAOHONGSHU", "OTHER"],
                    nullable: true,
                    description: "来源渠道",
                  },
                  sourceDetail: {
                    type: "string",
                    maxLength: 100,
                    nullable: true,
                    description: "来源详情",
                  },
                  registerEmail: { type: "string", format: "email", description: "注册邮箱" },
                  group: { type: "string", description: "目标 QQ 群 ID" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "提交成功" },
          "400": { description: "参数错误 / 邮箱域名不合法" },
          "409": { description: "已提交，不能重复创建" },
          "401": { description: "未认证" },
          "403": { description: "不在允许提交时间段或提交权限被封禁" },
          "429": { description: "超过个人或全站每日提交限额" },
          "503": { description: "限流服务不可用" },
          "500": { description: "服务器错误" },
        },
      },
      put: {
        tags: ["PreApplication"],
        summary: "更新/重新提交预申请（驳回后，按时段与每日限额控制）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["essay", "registerEmail", "group", "version"],
                properties: {
                  essay: { type: "string", minLength: 50, maxLength: 300 },
                  source: {
                    type: "string",
                    enum: ["TIEBA", "BILIBILI", "DOUYIN", "XIAOHONGSHU", "OTHER"],
                    nullable: true,
                  },
                  sourceDetail: { type: "string", maxLength: 100, nullable: true },
                  registerEmail: { type: "string", format: "email" },
                  group: { type: "string" },
                  version: { type: "integer", description: "乐观锁版本号" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "更新成功" },
          "400": { description: "参数错误 / 超过重新提交次数限制" },
          "401": { description: "未认证" },
          "403": { description: "不在允许提交时间段或提交权限被封禁" },
          "404": { description: "未找到预申请记录" },
          "429": { description: "超过个人或全站每日提交限额" },
          "503": { description: "限流服务不可用" },
          "409": { description: "版本冲突" },
        },
      },
    },
    "/pre-application/appeal": {
      get: {
        tags: ["PreApplication"],
        summary: "获取当前用户最新预申请的申诉信息",
        responses: {
          "200": {
            description: "最新预申请申诉信息",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    preApplication: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string" },
                        status: { type: "string" },
                        guidance: { type: "string", nullable: true },
                        queryToken: { type: "string", nullable: true },
                        reviewedAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                        reviewedBy: {
                          type: "object",
                          nullable: true,
                          properties: {
                            id: { type: "string" },
                            name: { type: "string", nullable: true },
                            email: { type: "string", nullable: true },
                          },
                        },
                      },
                    },
                    appeals: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          preApplicationId: { type: "string" },
                          userId: { type: "string" },
                          status: { type: "string", enum: ["PENDING", "REJECTED", "OVERRIDDEN"] },
                          reason: { type: "string" },
                          reviewComment: { type: "string", nullable: true },
                          reviewedAt: { type: "string", format: "date-time", nullable: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" },
                          reviewedBy: {
                            type: "object",
                            nullable: true,
                            properties: {
                              id: { type: "string" },
                              name: { type: "string", nullable: true },
                              email: { type: "string", nullable: true },
                            },
                          },
                        },
                      },
                    },
                    availability: {
                      type: "object",
                      properties: {
                        canCreate: { type: "boolean" },
                        reason: {
                          type: "string",
                          nullable: true,
                          enum: [
                            "APPEAL_DISABLED",
                            "PRE_APPLICATION_NOT_REJECTED",
                            "PENDING_APPEAL_EXISTS",
                            "APPEAL_COOLDOWN_ACTIVE",
                          ],
                        },
                        cooldownRemainingSeconds: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "未认证" },
          "500": { description: "获取申诉信息失败" },
          "503": { description: "数据库未配置" },
        },
      },
      post: {
        tags: ["PreApplication"],
        summary: "提交预申请申诉",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["preApplicationId", "reason"],
                properties: {
                  preApplicationId: { type: "string", description: "预申请 ID" },
                  reason: {
                    type: "string",
                    minLength: 1,
                    maxLength: 2000,
                    description: "申诉理由",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "申诉提交成功" },
          "400": { description: "参数错误" },
          "401": { description: "未认证" },
          "403": { description: "申诉功能未开启" },
          "404": { description: "预申请不存在" },
          "409": { description: "预申请状态不允许申诉或已有待处理申诉" },
          "429": { description: "申诉冷却中" },
          "500": { description: "提交申诉失败" },
          "503": { description: "数据库未配置" },
        },
      },
    },
    "/pre-application/draft": {
      get: {
        tags: ["PreApplication"],
        summary: "获取当前用户预申请草稿",
        responses: {
          "200": {
            description: "草稿详情",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    draft: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string" },
                        essay: { type: "string" },
                        source: {
                          type: "string",
                          enum: ["TIEBA", "BILIBILI", "DOUYIN", "XIAOHONGSHU", "OTHER"],
                          nullable: true,
                        },
                        sourceDetail: { type: "string", nullable: true },
                        registerEmail: { type: "string" },
                        group: { type: "string" },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "未认证" },
          "500": { description: "获取草稿失败" },
        },
      },
      put: {
        tags: ["PreApplication"],
        summary: "保存当前用户预申请草稿（不触发正式提交流程）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  essay: {
                    type: "string",
                    nullable: true,
                    description: "草稿小作文，仅校验最大长度",
                  },
                  source: {
                    type: "string",
                    enum: ["TIEBA", "BILIBILI", "DOUYIN", "XIAOHONGSHU", "OTHER"],
                    nullable: true,
                  },
                  sourceDetail: { type: "string", maxLength: 100, nullable: true },
                  registerEmail: { type: "string", nullable: true },
                  group: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "保存成功" },
          "400": { description: "参数错误 / 草稿超出最大长度 / 群组无效" },
          "401": { description: "未认证" },
          "500": { description: "保存草稿失败" },
        },
      },
      delete: {
        tags: ["PreApplication"],
        summary: "清空当前用户预申请草稿",
        responses: {
          "200": { description: "清空成功" },
          "401": { description: "未认证" },
          "500": { description: "清空草稿失败" },
        },
      },
    },

    // ── Public ──
    "/public/system-config": {
      get: {
        tags: ["Public"],
        summary: "获取公开系统配置",
        responses: {
          "200": {
            description: "系统配置",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    preApplicationEssayHint: { type: "string" },
                    preApplicationEssayMinLength: { type: "integer" },
                    preApplicationEssayMaxLength: { type: "integer" },
                    preApplicationDailyGlobalLimit: { type: "integer" },
                    preApplicationDailyUserLimit: { type: "integer" },
                    preApplicationSubmitStartTime: {
                      type: "string",
                      description: "HH:mm，Asia/Shanghai",
                    },
                    preApplicationSubmitEndTime: {
                      type: "string",
                      description: "HH:mm，Asia/Shanghai",
                    },
                    allowedEmailDomains: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/public/invite-code-config": {
      get: {
        tags: ["Public"],
        summary: "获取邀请码配置",
        responses: {
          "200": { description: "邀请码配置" },
        },
      },
    },

    // ── Tickets ──
    "/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "工单列表",
        responses: {
          "200": { description: "工单列表" },
          "401": { description: "未认证" },
        },
      },
      post: {
        tags: ["Tickets"],
        summary: "创建工单",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "content"],
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  category: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "创建成功" },
          "400": { description: "参数错误" },
        },
      },
    },
    "/tickets/{id}": {
      get: {
        tags: ["Tickets"],
        summary: "工单详情",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "工单详情" },
          "404": { description: "工单不存在" },
        },
      },
    },
    "/tickets/{id}/messages": {
      post: {
        tags: ["Chat"],
        summary: "发送工单消息",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "发送成功" },
          "400": { description: "参数错误" },
          "404": { description: "工单不存在" },
        },
      },
    },
  },
}
