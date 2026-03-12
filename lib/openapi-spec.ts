const jsonContent = (schema: Record<string, unknown>) => ({
  "application/json": {
    schema,
  },
})

const jsonResponse = (description: string, schema: Record<string, unknown>) => ({
  description,
  content: jsonContent(schema),
})

const apiErrorResponse = (description = "请求失败") =>
  jsonResponse(description, { $ref: "#/components/schemas/ApiError" })

const legacyStringErrorResponse = (description = "请求失败") =>
  jsonResponse(description, { $ref: "#/components/schemas/LegacyStringError" })

const legacyNestedMessageErrorResponse = (description = "请求失败") =>
  jsonResponse(description, { $ref: "#/components/schemas/LegacyNestedMessageError" })

const redirectResponse = (description: string) => ({
  description,
  headers: {
    Location: {
      description: "重定向地址",
      schema: { type: "string" },
    },
  },
})

const pathParameter = (name: string, description?: string) => ({
  name,
  in: "path" as const,
  required: true,
  schema: { type: "string" },
  ...(description ? { description } : {}),
})

const apiErrorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        meta: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  },
} as const

const latestAuthPaths = {
  "/auth/github": {
    get: {
      tags: ["Auth"],
      summary: "发起 GitHub OAuth 登录",
      parameters: [
        {
          name: "fp_ctx",
          in: "query" as const,
          schema: { type: "string" },
          description: "可选的指纹上下文 token",
        },
      ],
      responses: {
        "307": redirectResponse("重定向到 GitHub 授权页面"),
        "403": apiErrorResponse("OAuth 登录已关闭"),
        "404": apiErrorResponse("GitHub OAuth 未配置"),
        "500": apiErrorResponse("生成授权地址失败"),
      },
    },
  },
  "/auth/google": {
    get: {
      tags: ["Auth"],
      summary: "发起 Google OAuth 登录",
      parameters: [
        {
          name: "fp_ctx",
          in: "query" as const,
          schema: { type: "string" },
          description: "可选的指纹上下文 token",
        },
      ],
      responses: {
        "307": redirectResponse("重定向到 Google 授权页面"),
        "403": apiErrorResponse("OAuth 登录已关闭"),
        "404": apiErrorResponse("Google OAuth 未配置"),
        "500": apiErrorResponse("生成授权地址失败"),
      },
    },
  },
  "/auth/linuxdo": {
    get: {
      tags: ["Auth"],
      summary: "发起 LinuxDo OAuth 登录",
      parameters: [
        {
          name: "fp_ctx",
          in: "query" as const,
          schema: { type: "string" },
          description: "可选的指纹上下文 token",
        },
      ],
      responses: {
        "307": redirectResponse("重定向到 LinuxDo 授权页面"),
        "403": apiErrorResponse("OAuth 登录已关闭"),
        "404": apiErrorResponse("LinuxDo OAuth 未配置"),
        "500": apiErrorResponse("生成授权地址失败"),
      },
    },
  },
  "/auth/callback/github": {
    get: {
      tags: ["Auth"],
      summary: "处理 GitHub OAuth 回调",
      parameters: [
        { name: "code", in: "query" as const, schema: { type: "string" } },
        { name: "state", in: "query" as const, schema: { type: "string" } },
      ],
      responses: {
        "307": redirectResponse("登录成功或失败后重定向到站内页面"),
      },
    },
  },
  "/auth/callback/google": {
    get: {
      tags: ["Auth"],
      summary: "处理 Google OAuth 回调",
      parameters: [
        { name: "code", in: "query" as const, schema: { type: "string" } },
        { name: "state", in: "query" as const, schema: { type: "string" } },
      ],
      responses: {
        "307": redirectResponse("登录成功或失败后重定向到站内页面"),
      },
    },
  },
  "/auth/callback/linuxdo": {
    get: {
      tags: ["Auth"],
      summary: "处理 LinuxDo OAuth 回调",
      parameters: [
        { name: "code", in: "query" as const, schema: { type: "string" } },
        { name: "state", in: "query" as const, schema: { type: "string" } },
      ],
      responses: {
        "307": redirectResponse("登录成功或失败后重定向到站内页面"),
      },
    },
  },
  "/auth/forgot-password": {
    post: {
      tags: ["Auth"],
      summary: "发送重置密码邮件",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email"],
              properties: {
                email: { type: "string", format: "email" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("请求已受理", {
          type: "object",
          required: ["success", "message"],
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            resetUrl: { type: "string", nullable: true },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "500": apiErrorResponse("发送失败"),
        "503": apiErrorResponse("服务不可用"),
      },
    },
  },
  "/auth/passkey/register/options": {
    post: {
      tags: ["Auth"],
      summary: "获取 Passkey 注册选项",
      responses: {
        "200": jsonResponse("Passkey 注册选项", {
          type: "object",
          required: ["options"],
          properties: {
            options: { $ref: "#/components/schemas/LooseObject" },
          },
        }),
        "401": apiErrorResponse("未登录"),
        "500": apiErrorResponse("生成注册选项失败"),
        "503": apiErrorResponse("Passkey 或数据库未配置"),
      },
    },
  },
  "/auth/passkey/register/verify": {
    post: {
      tags: ["Auth"],
      summary: "验证并保存 Passkey",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["credential"],
              properties: {
                credential: { $ref: "#/components/schemas/LooseObject" },
              },
            },
          },
        },
      },
      responses: {
        "201": jsonResponse("Passkey 创建成功", {
          type: "object",
          required: ["success", "passkey"],
          properties: {
            success: { type: "boolean" },
            passkey: { $ref: "#/components/schemas/Passkey" },
          },
        }),
        "400": apiErrorResponse("请求无效或挑战已过期"),
        "401": apiErrorResponse("未登录"),
        "409": apiErrorResponse("Passkey 已存在"),
        "500": apiErrorResponse("Passkey 注册失败"),
        "503": apiErrorResponse("Passkey 或数据库未配置"),
      },
    },
  },
  "/auth/passkey/authenticate/options": {
    post: {
      tags: ["Auth"],
      summary: "获取 Passkey 登录选项",
      responses: {
        "200": jsonResponse("Passkey 登录选项", {
          type: "object",
          required: ["options"],
          properties: {
            options: { $ref: "#/components/schemas/LooseObject" },
          },
        }),
        "500": apiErrorResponse("生成登录选项失败"),
        "503": apiErrorResponse("Passkey 或数据库未配置"),
      },
    },
  },
  "/auth/passkey/authenticate/verify": {
    post: {
      tags: ["Auth"],
      summary: "验证 Passkey 登录",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["credential"],
              properties: {
                credential: { $ref: "#/components/schemas/LooseObject" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("登录成功", {
          type: "object",
          required: ["success", "user"],
          properties: {
            success: { type: "boolean" },
            user: { $ref: "#/components/schemas/AuthUser" },
          },
        }),
        "400": apiErrorResponse("挑战已过期或请求无效"),
        "401": apiErrorResponse("认证失败"),
        "403": apiErrorResponse("账号不可登录"),
        "500": apiErrorResponse("认证失败"),
        "503": apiErrorResponse("Passkey 或数据库未配置"),
      },
    },
  },
  "/auth/reactivate": {
    get: {
      tags: ["Auth"],
      summary: "重新激活已删除账号",
      parameters: [{ name: "token", in: "query" as const, schema: { type: "string" } }],
      responses: {
        "200": jsonResponse("账号已重新激活", {
          type: "object",
          required: ["success", "message"],
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        }),
        "400": apiErrorResponse("无效或过期的激活 token"),
        "404": apiErrorResponse("用户不存在"),
        "500": apiErrorResponse("重新激活失败"),
        "503": apiErrorResponse("服务不可用"),
      },
    },
  },
  "/auth/reset-password": {
    get: {
      tags: ["Auth"],
      summary: "验证重置密码 token",
      parameters: [{ name: "token", in: "query" as const, schema: { type: "string" } }],
      responses: {
        "200": jsonResponse("token 有效", {
          type: "object",
          required: ["success", "user"],
          properties: {
            success: { type: "boolean" },
            user: {
              type: "object",
              properties: {
                email: { type: "string", format: "email" },
                name: { type: "string", nullable: true },
              },
            },
          },
        }),
        "400": apiErrorResponse("token 缺失或无效"),
        "500": apiErrorResponse("验证失败"),
        "503": apiErrorResponse("服务不可用"),
      },
    },
    post: {
      tags: ["Auth"],
      summary: "重置密码并自动登录",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["token", "password"],
              properties: {
                token: { type: "string" },
                password: { type: "string", minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("密码已重置", {
          type: "object",
          required: ["success", "message"],
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        }),
        "400": apiErrorResponse("参数错误或 token 无效"),
        "500": apiErrorResponse("重置失败"),
        "503": apiErrorResponse("服务不可用"),
      },
    },
  },
  "/auth/send-verification-code": {
    post: {
      tags: ["Auth"],
      summary: "发送邮箱验证码",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email"],
              properties: {
                email: { type: "string", format: "email" },
                purpose: {
                  type: "string",
                  enum: ["register", "reset-password", "change-email", "login"],
                  default: "register",
                },
                locale: { type: "string", enum: ["zh", "en"], nullable: true },
                turnstileToken: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("验证码发送结果", {
          type: "object",
          required: ["success", "message"],
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "429": apiErrorResponse("请求过于频繁"),
        "500": apiErrorResponse("发送失败"),
        "503": apiErrorResponse("邮件或 Redis 服务不可用"),
      },
    },
  },
} as const

const latestAdminPaths = {
  "/admin/analytics": {
    get: {
      tags: ["Admin"],
      summary: "管理员分析概览",
      responses: {
        "200": jsonResponse("分析数据", {
          type: "object",
          properties: {
            userGrowth: { $ref: "#/components/schemas/LooseObject" },
            postStats: { $ref: "#/components/schemas/LooseObject" },
            viewStats: { $ref: "#/components/schemas/LooseObject" },
            topCountries: {
              type: "array",
              items: { $ref: "#/components/schemas/LooseObject" },
            },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("服务器错误"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/clear-cache": {
    post: {
      tags: ["Admin"],
      summary: "清理站点缓存",
      responses: {
        "200": jsonResponse("缓存已清理", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("清理失败"),
      },
    },
  },
  "/admin/dashboard": {
    get: {
      tags: ["Admin"],
      summary: "管理员数据看板",
      parameters: [
        { name: "range", in: "query" as const, schema: { type: "string" } },
        { name: "granularity", in: "query" as const, schema: { type: "string" } },
      ],
      responses: {
        "200": jsonResponse("看板数据", {
          type: "object",
          properties: {
            range: { type: "string" },
            granularity: { type: "string" },
            kpis: { $ref: "#/components/schemas/LooseObject" },
            series: { $ref: "#/components/schemas/LooseObject" },
            distributions: { $ref: "#/components/schemas/LooseObject" },
            reviewerStats: { $ref: "#/components/schemas/LooseObject" },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("服务器错误"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/email-api-configs": {
    get: {
      tags: ["Admin"],
      summary: "获取邮件 API 配置列表",
      responses: {
        "200": jsonResponse("邮件 API 配置列表", {
          type: "array",
          items: { $ref: "#/components/schemas/EmailApiConfig" },
        }),
        "401": legacyStringErrorResponse("未认证"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
    post: {
      tags: ["Admin"],
      summary: "创建邮件 API 配置",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "host", "user", "pass"],
              properties: {
                name: { type: "string" },
                host: { type: "string" },
                port: { type: "integer", default: 587 },
                user: { type: "string" },
                pass: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": jsonResponse("创建成功", { $ref: "#/components/schemas/EmailApiConfig" }),
        "400": legacyStringErrorResponse("参数错误"),
        "401": legacyStringErrorResponse("未认证"),
        "500": legacyStringErrorResponse("创建失败"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
  },
  "/admin/email-api-configs/{id}": {
    get: {
      tags: ["Admin"],
      summary: "获取单个邮件 API 配置",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("邮件 API 配置", { $ref: "#/components/schemas/EmailApiConfig" }),
        "401": legacyStringErrorResponse("未认证"),
        "404": legacyStringErrorResponse("配置不存在"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
    put: {
      tags: ["Admin"],
      summary: "更新邮件 API 配置",
      parameters: [pathParameter("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                host: { type: "string" },
                port: { type: "integer" },
                user: { type: "string" },
                pass: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("更新成功", { $ref: "#/components/schemas/EmailApiConfig" }),
        "400": legacyStringErrorResponse("参数错误"),
        "401": legacyStringErrorResponse("未认证"),
        "500": legacyStringErrorResponse("更新失败"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
    delete: {
      tags: ["Admin"],
      summary: "删除邮件 API 配置",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("删除成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "400": legacyStringErrorResponse("无法删除"),
        "401": legacyStringErrorResponse("未认证"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
  },
  "/admin/email-logs/resend": {
    post: {
      tags: ["Admin"],
      summary: "批量重发邮件日志",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["ids"],
              properties: {
                ids: {
                  type: "array",
                  minItems: 1,
                  maxItems: 50,
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("重发结果", {
          type: "object",
          required: ["success", "results", "summary"],
          properties: {
            success: { type: "boolean" },
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  success: { type: "boolean" },
                  error: { type: "string", nullable: true },
                },
              },
            },
            summary: {
              type: "object",
              properties: {
                total: { type: "integer" },
                success: { type: "integer" },
                failed: { type: "integer" },
              },
            },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "403": apiErrorResponse("无权限"),
        "404": apiErrorResponse("记录不存在"),
        "500": apiErrorResponse("重发失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/posts": {
    get: {
      tags: ["Admin"],
      summary: "管理员查看帖子列表",
      parameters: [
        { name: "search", in: "query" as const, schema: { type: "string" } },
        { name: "status", in: "query" as const, schema: { type: "string" } },
        { name: "sortBy", in: "query" as const, schema: { type: "string" } },
        { name: "sortOrder", in: "query" as const, schema: { type: "string" } },
        { name: "page", in: "query" as const, schema: { type: "integer" } },
        { name: "limit", in: "query" as const, schema: { type: "integer" } },
      ],
      responses: {
        "200": jsonResponse("帖子列表", {
          type: "object",
          properties: {
            posts: {
              type: "array",
              items: { $ref: "#/components/schemas/LooseObject" },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("服务器错误"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/posts/{id}": {
    get: {
      tags: ["Admin"],
      summary: "管理员查看帖子详情",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("帖子详情", {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            status: { type: "string" },
            views: { type: "integer" },
            author: { $ref: "#/components/schemas/LooseObject" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "404": apiErrorResponse("帖子不存在"),
        "500": apiErrorResponse("服务器错误"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    put: {
      tags: ["Admin"],
      summary: "管理员更新帖子状态",
      parameters: [pathParameter("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("更新成功", { $ref: "#/components/schemas/LooseObject" }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("服务器错误"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    delete: {
      tags: ["Admin"],
      summary: "管理员删除帖子",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("删除成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("服务器错误"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/pre-applications/batch-archive": {
    post: {
      tags: ["Admin"],
      summary: "批量归档预申请",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["ids"],
              properties: {
                ids: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("归档完成", {
          type: "object",
          required: ["success", "count"],
          properties: {
            success: { type: "boolean" },
            count: { type: "integer" },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "409": apiErrorResponse("当前状态不允许归档"),
        "500": apiErrorResponse("归档失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/pre-applications/export": {
    get: {
      tags: ["Admin"],
      summary: "导出预申请 CSV",
      parameters: [
        { name: "search", in: "query" as const, schema: { type: "string" } },
        { name: "status", in: "query" as const, schema: { type: "string" } },
        { name: "registerEmail", in: "query" as const, schema: { type: "string" } },
        { name: "queryToken", in: "query" as const, schema: { type: "string" } },
        { name: "reviewRound", in: "query" as const, schema: { type: "integer" } },
        { name: "inviteStatus", in: "query" as const, schema: { type: "string" } },
        { name: "fingerprintHash", in: "query" as const, schema: { type: "string" } },
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
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("导出失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/pre-applications/{id}/code-sent": {
    patch: {
      tags: ["Admin"],
      summary: "更新邀请码已发送状态",
      parameters: [pathParameter("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["codeSent"],
              properties: {
                codeSent: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("状态已更新", {
          type: "object",
          properties: {
            id: { type: "string" },
            codeSent: { type: "boolean" },
            codeSentAt: { type: "string", format: "date-time", nullable: true },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "404": apiErrorResponse("记录不存在"),
        "409": apiErrorResponse("当前状态不允许更新"),
        "500": apiErrorResponse("更新失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/pre-applications/{id}/duplicate-check": {
    post: {
      tags: ["Admin"],
      summary: "检查本地重复申请",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("重复检查结果", {
          type: "object",
          properties: {
            hasDuplicates: { type: "boolean" },
            records: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
            totalCandidates: { type: "integer" },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "404": apiErrorResponse("记录不存在"),
        "500": apiErrorResponse("检查失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/pre-applications/{id}/fingerprint": {
    get: {
      tags: ["Admin"],
      summary: "查看预申请指纹关联信息",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("指纹详情", {
          type: "object",
          properties: {
            id: { type: "string" },
            fingerprintHash: { type: "string", nullable: true },
            fingerprintStatus: { type: "string", nullable: true },
            fingerprintCollectedAt: { type: "string", format: "date-time", nullable: true },
            relatedUsersCount: { type: "integer" },
            relatedApplicationsCount: { type: "integer" },
            relatedUsers: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
            relatedApplications: {
              type: "array",
              items: { $ref: "#/components/schemas/LooseObject" },
            },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "404": apiErrorResponse("记录不存在"),
        "500": apiErrorResponse("查询失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/pre-applications/{id}/history": {
    get: {
      tags: ["Admin"],
      summary: "查看预申请历史版本",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("历史版本列表", {
          type: "object",
          properties: {
            records: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("查询失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/reset-database": {
    post: {
      tags: ["Admin"],
      summary: "重置数据库",
      responses: {
        "200": jsonResponse("重置成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("重置失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/shadow-banned-users": {
    get: {
      tags: ["Admin"],
      summary: "获取 Shadow Ban 用户列表",
      responses: {
        "200": jsonResponse("Shadow Ban 列表", {
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("查询失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    post: {
      tags: ["Admin"],
      summary: "创建 Shadow Ban 记录",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userId", "reason"],
              properties: {
                userId: { type: "string" },
                reason: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("创建成功", {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            reason: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            user: { $ref: "#/components/schemas/LooseObject" },
            createdBy: { $ref: "#/components/schemas/LooseObject" },
            shadowedPreApplications: { type: "integer" },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "404": apiErrorResponse("用户不存在"),
        "500": apiErrorResponse("保存失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/shadow-banned-users/{userId}": {
    delete: {
      tags: ["Admin"],
      summary: "解除 Shadow Ban",
      parameters: [pathParameter("userId")],
      responses: {
        "200": jsonResponse("解除成功", {
          type: "object",
          required: ["success", "restoredPreApplications"],
          properties: {
            success: { type: "boolean" },
            restoredPreApplications: { type: "integer" },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("无权限"),
        "404": apiErrorResponse("记录不存在"),
        "500": apiErrorResponse("解除失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/admin/test-email": {
    post: {
      tags: ["Admin"],
      summary: "发送测试邮件",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["to"],
              properties: {
                to: { type: "string", format: "email" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("发送成功", {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            provider: { type: "string", nullable: true },
          },
        }),
        "400": apiErrorResponse("参数错误"),
        "403": apiErrorResponse("无权限"),
        "500": apiErrorResponse("发送失败"),
        "503": apiErrorResponse("服务不可用"),
      },
    },
  },
  "/admin/tickets": {
    get: {
      tags: ["Admin"],
      summary: "管理员查看工单列表",
      parameters: [
        { name: "page", in: "query" as const, schema: { type: "integer" } },
        { name: "pageSize", in: "query" as const, schema: { type: "integer" } },
        { name: "status", in: "query" as const, schema: { type: "string" } },
      ],
      responses: {
        "200": jsonResponse("工单列表", {
          type: "object",
          properties: {
            tickets: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
            total: { type: "integer" },
            page: { type: "integer" },
            pageSize: { type: "integer" },
          },
        }),
        "403": legacyStringErrorResponse("无权限"),
        "500": legacyStringErrorResponse("获取失败"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
  },
  "/admin/tickets/{id}": {
    get: {
      tags: ["Admin"],
      summary: "管理员查看工单详情",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("工单详情", { $ref: "#/components/schemas/LooseObject" }),
        "403": legacyStringErrorResponse("无权限"),
        "404": legacyStringErrorResponse("工单不存在"),
        "500": legacyStringErrorResponse("获取失败"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
  },
  "/admin/tickets/{id}/messages": {
    post: {
      tags: ["Admin"],
      summary: "管理员发送工单消息",
      parameters: [pathParameter("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["content"],
              properties: { content: { type: "string" } },
            },
          },
        },
      },
      responses: {
        "201": jsonResponse("发送成功", { $ref: "#/components/schemas/LooseObject" }),
        "400": legacyStringErrorResponse("参数错误"),
        "403": legacyStringErrorResponse("无权限"),
        "404": legacyStringErrorResponse("工单不存在"),
        "500": legacyStringErrorResponse("发送失败"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
  },
  "/admin/tickets/{id}/status": {
    patch: {
      tags: ["Admin"],
      summary: "更新工单状态",
      parameters: [pathParameter("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: {
                  type: "string",
                  enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
                },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("更新成功", { $ref: "#/components/schemas/LooseObject" }),
        "400": legacyStringErrorResponse("参数错误"),
        "403": legacyStringErrorResponse("无权限"),
        "404": legacyStringErrorResponse("工单不存在"),
        "500": legacyStringErrorResponse("更新失败"),
        "503": legacyStringErrorResponse("数据库不可用"),
      },
    },
  },
} as const

const latestDashboardPaths = {
  "/dashboard/account": {
    delete: {
      tags: ["Dashboard"],
      summary: "删除当前账号",
      responses: {
        "200": jsonResponse("删除成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("删除失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/apply-admin": {
    post: {
      tags: ["Dashboard"],
      summary: "申请成为管理员",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["reason"],
              properties: {
                reason: { type: "string", minLength: 1, maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("申请已提交", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "400": apiErrorResponse("当前状态不允许申请"),
        "401": apiErrorResponse("未认证"),
        "403": apiErrorResponse("功能已关闭"),
        "500": apiErrorResponse("申请失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/apply-admin/status": {
    get: {
      tags: ["Dashboard"],
      summary: "查询管理员申请状态",
      responses: {
        "200": jsonResponse("申请状态", {
          type: "object",
          required: ["hasApplied"],
          properties: { hasApplied: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/manual-issue-record": {
    post: {
      tags: ["Dashboard"],
      summary: "记录手动发码异常",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["note"],
              properties: {
                note: { type: "string", minLength: 1, maxLength: 1000 },
                targetDescription: { type: "string", maxLength: 200, nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("记录成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("记录失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/messages/{id}": {
    get: {
      tags: ["Dashboard"],
      summary: "获取单条站内信",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("站内信详情", { $ref: "#/components/schemas/DashboardMessage" }),
        "401": apiErrorResponse("未认证"),
        "404": apiErrorResponse("站内信不存在"),
        "500": apiErrorResponse("获取失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    delete: {
      tags: ["Dashboard"],
      summary: "删除单条站内信",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("删除成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "404": apiErrorResponse("站内信不存在"),
        "500": apiErrorResponse("删除失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/passkeys": {
    get: {
      tags: ["Dashboard"],
      summary: "获取当前用户 Passkey 列表",
      responses: {
        "200": jsonResponse("Passkey 列表", {
          type: "object",
          required: ["passkeys"],
          properties: {
            passkeys: {
              type: "array",
              items: { $ref: "#/components/schemas/Passkey" },
            },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("获取失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/passkeys/{id}": {
    delete: {
      tags: ["Dashboard"],
      summary: "删除指定 Passkey",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("删除成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "404": apiErrorResponse("Passkey 不存在"),
        "500": apiErrorResponse("删除失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/posts": {
    get: {
      tags: ["Dashboard"],
      summary: "获取当前用户帖子列表",
      parameters: [
        { name: "page", in: "query" as const, schema: { type: "integer" } },
        { name: "pageSize", in: "query" as const, schema: { type: "integer" } },
        { name: "sortBy", in: "query" as const, schema: { type: "string" } },
        { name: "sortOrder", in: "query" as const, schema: { type: "string" } },
        { name: "search", in: "query" as const, schema: { type: "string" } },
      ],
      responses: {
        "200": jsonResponse("帖子列表", {
          type: "object",
          properties: {
            posts: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
            total: { type: "integer" },
            page: { type: "integer" },
            pageSize: { type: "integer" },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("获取失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    post: {
      tags: ["Dashboard"],
      summary: "创建帖子",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["title", "content"],
              properties: {
                title: { type: "string", minLength: 1, maxLength: 200 },
                content: { type: "string", minLength: 1 },
                status: { type: "string", enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
              },
            },
          },
        },
      },
      responses: {
        "201": jsonResponse("创建成功", { $ref: "#/components/schemas/DashboardPost" }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("创建失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/dashboard/posts/{id}": {
    get: {
      tags: ["Dashboard"],
      summary: "获取单个帖子",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("帖子详情", { $ref: "#/components/schemas/DashboardPost" }),
        "401": apiErrorResponse("未认证"),
        "404": apiErrorResponse("帖子不存在"),
        "500": apiErrorResponse("获取失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    put: {
      tags: ["Dashboard"],
      summary: "更新帖子",
      parameters: [pathParameter("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                title: { type: "string", minLength: 1, maxLength: 200 },
                content: { type: "string", minLength: 1 },
                status: { type: "string", enum: ["DRAFT", "PUBLISHED"] },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("更新成功", { $ref: "#/components/schemas/DashboardPost" }),
        "400": apiErrorResponse("参数错误"),
        "401": apiErrorResponse("未认证"),
        "404": apiErrorResponse("帖子不存在"),
        "500": apiErrorResponse("更新失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    delete: {
      tags: ["Dashboard"],
      summary: "删除帖子",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("删除成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "401": apiErrorResponse("未认证"),
        "404": apiErrorResponse("帖子不存在"),
        "500": apiErrorResponse("删除失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
} as const

const latestChatPaths = {
  "/chat": {
    get: {
      tags: ["Chat"],
      summary: "获取公共聊天消息列表",
      parameters: [
        { name: "cursor", in: "query" as const, schema: { type: "string", format: "date-time" } },
        { name: "limit", in: "query" as const, schema: { type: "integer", default: 50, maximum: 100 } },
      ],
      responses: {
        "200": jsonResponse("聊天消息列表", {
          type: "object",
          properties: {
            messages: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } },
            hasMore: { type: "boolean" },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("获取失败"),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
    post: {
      tags: ["Chat"],
      summary: "发送公共聊天消息",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["content"],
              properties: {
                content: { type: "string", minLength: 1, maxLength: 500000 },
                replyToId: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "201": jsonResponse("发送成功", { $ref: "#/components/schemas/ChatMessage" }),
        "400": legacyNestedMessageErrorResponse("参数错误"),
        "401": legacyNestedMessageErrorResponse("未认证"),
        "500": legacyNestedMessageErrorResponse("发送失败"),
        "503": legacyNestedMessageErrorResponse("数据库不可用"),
      },
    },
    delete: {
      tags: ["Chat"],
      summary: "撤回公共聊天消息",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["messageId"],
              properties: {
                messageId: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("撤回成功", {
          type: "object",
          required: ["success"],
          properties: { success: { type: "boolean" } },
        }),
        "400": legacyNestedMessageErrorResponse("参数错误"),
        "401": legacyNestedMessageErrorResponse("未认证"),
        "403": legacyNestedMessageErrorResponse("无权撤回"),
        "404": legacyNestedMessageErrorResponse("消息不存在"),
        "500": legacyNestedMessageErrorResponse("撤回失败"),
        "503": legacyNestedMessageErrorResponse("数据库不可用"),
      },
    },
  },
  "/private-chats": {
    get: {
      tags: ["Chat"],
      summary: "获取私聊会话列表",
      responses: {
        "200": jsonResponse("私聊会话列表", {
          type: "object",
          properties: {
            chats: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
          },
        }),
        "401": legacyNestedMessageErrorResponse("未认证"),
        "500": legacyNestedMessageErrorResponse("获取失败"),
        "503": legacyNestedMessageErrorResponse("数据库不可用"),
      },
    },
    post: {
      tags: ["Chat"],
      summary: "创建或获取与管理员的私聊会话",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["adminId"],
              properties: {
                adminId: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("会话已创建或获取", {
          type: "object",
          required: ["chatId"],
          properties: { chatId: { type: "string" } },
        }),
        "400": legacyNestedMessageErrorResponse("参数错误"),
        "401": legacyNestedMessageErrorResponse("未认证"),
        "500": legacyNestedMessageErrorResponse("创建失败"),
        "503": legacyNestedMessageErrorResponse("数据库不可用"),
      },
    },
  },
  "/private-chats/{id}": {
    get: {
      tags: ["Chat"],
      summary: "获取单个私聊会话",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("私聊会话详情", { $ref: "#/components/schemas/LooseObject" }),
        "401": legacyNestedMessageErrorResponse("未认证"),
        "403": legacyNestedMessageErrorResponse("无权限"),
        "404": legacyNestedMessageErrorResponse("会话不存在"),
        "500": legacyNestedMessageErrorResponse("获取失败"),
        "503": legacyNestedMessageErrorResponse("数据库不可用"),
      },
    },
  },
  "/private-chats/{id}/messages": {
    get: {
      tags: ["Chat"],
      summary: "获取私聊消息列表",
      parameters: [pathParameter("id")],
      responses: {
        "200": jsonResponse("私聊消息列表", {
          type: "object",
          properties: {
            messages: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
          },
        }),
        "401": legacyNestedMessageErrorResponse("未认证"),
        "403": legacyNestedMessageErrorResponse("无权限"),
        "404": legacyNestedMessageErrorResponse("会话不存在"),
        "500": legacyNestedMessageErrorResponse("获取失败"),
        "503": legacyNestedMessageErrorResponse("数据库不可用"),
      },
    },
    post: {
      tags: ["Chat"],
      summary: "发送私聊消息",
      parameters: [pathParameter("id")],
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
        "201": jsonResponse("发送成功", { $ref: "#/components/schemas/LooseObject" }),
        "400": legacyNestedMessageErrorResponse("参数错误"),
        "401": legacyNestedMessageErrorResponse("未认证"),
        "403": legacyNestedMessageErrorResponse("无权限"),
        "404": legacyNestedMessageErrorResponse("会话不存在"),
        "500": legacyNestedMessageErrorResponse("发送失败"),
        "503": legacyNestedMessageErrorResponse("数据库不可用"),
      },
    },
  },
} as const

const latestPreApplicationPaths = {
  "/pre-application-feed": {
    get: {
      tags: ["PreApplication"],
      summary: "获取预申请公开动态",
      responses: {
        "200": jsonResponse("预申请动态", {
          type: "array",
          items: {
            type: "object",
            properties: {
              status: { type: "string" },
              userName: { type: "string", nullable: true },
              registerEmail: { type: "string" },
              source: { type: "string" },
              codeSent: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              reviewedAt: { type: "string", format: "date-time", nullable: true },
            },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("获取失败"),
      },
    },
  },
  "/pre-application/ai-preview": {
    post: {
      tags: ["PreApplication"],
      summary: "AI 预审预申请文案",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["essay"],
              properties: {
                essay: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("AI 预审结果", {
          type: "object",
          properties: {
            result: { $ref: "#/components/schemas/LooseObject" },
          },
        }),
        "400": apiErrorResponse("文案长度不合法"),
        "401": apiErrorResponse("未认证"),
        "500": apiErrorResponse("预审失败"),
        "503": apiErrorResponse("AI 服务未配置"),
      },
    },
  },
  "/pre-application/precheck": {
    post: {
      tags: ["PreApplication"],
      summary: "提交前预检查",
      responses: {
        "200": jsonResponse("预检查结果", {
          type: "object",
          properties: {
            allowed: { type: "boolean" },
            reason: { type: "string", nullable: true },
            submitQuotaStatus: { type: "string", nullable: true },
            submitBannedUntil: { type: "string", format: "date-time", nullable: true },
            remainingSeconds: { type: "integer", nullable: true },
            captchaEnabled: { type: "boolean" },
            captchaProvider: { type: "string", nullable: true },
            captchaPublicConfig: { $ref: "#/components/schemas/LooseObject" },
            captchaTicket: { type: "string", nullable: true },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "503": apiErrorResponse("服务不可用"),
      },
    },
  },
} as const

const latestPublicPaths = {
  "/build-info": {
    get: {
      tags: ["System"],
      summary: "获取构建与最新提交信息",
      parameters: [
        {
          name: "source",
          in: "query" as const,
          schema: { type: "string", enum: ["build", "github"] },
        },
      ],
      responses: {
        "200": jsonResponse("构建信息", { $ref: "#/components/schemas/BuildInfo" }),
      },
    },
  },
  "/features": {
    get: {
      tags: ["System"],
      summary: "获取公开功能开关",
      responses: {
        "200": jsonResponse("功能开关", {
          type: "object",
          properties: {
            oauth: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                providers: { type: "array", items: { type: "string" } },
              },
            },
            database: { type: "boolean" },
            email: { type: "boolean" },
          },
        }),
      },
    },
  },
  "/fingerprint/oauth-context": {
    post: {
      tags: ["Public"],
      summary: "创建 OAuth 登录指纹上下文",
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                fingerprintVisitorId: { type: "string", nullable: true },
                fingerprintStatus: { type: "string", nullable: true },
                fingerprintFailureReason: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("上下文 token", {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string" } },
        }),
        "500": apiErrorResponse("创建失败"),
      },
    },
  },
  "/guest/apply": {
    get: {
      tags: ["Public"],
      summary: "游客提交入口（已关闭）",
      responses: {
        "403": legacyStringErrorResponse("游客提交已关闭"),
      },
    },
    post: {
      tags: ["Public"],
      summary: "游客提交入口（已关闭）",
      responses: {
        "403": legacyStringErrorResponse("游客提交已关闭"),
      },
    },
  },
  "/guest/apply/precheck": {
    post: {
      tags: ["Public"],
      summary: "游客提交预检查（已关闭）",
      responses: {
        "403": legacyStringErrorResponse("游客提交已关闭"),
      },
    },
  },
  "/health": {
    get: {
      tags: ["System"],
      summary: "健康检查",
      responses: {
        "200": jsonResponse("健康状态", {
          oneOf: [
            { $ref: "#/components/schemas/HealthBase" },
            { $ref: "#/components/schemas/HealthAdmin" },
          ],
        }),
      },
    },
  },
  "/public/check-invite-codes": {
    post: {
      tags: ["Public"],
      summary: "批量检测邀请码有效性",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["codes"],
              properties: {
                codes: {
                  type: "array",
                  minItems: 1,
                  maxItems: 5,
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("检测结果", {
          type: "object",
          properties: {
            success: { type: "boolean" },
            total: { type: "integer" },
            results: { type: "array", items: { $ref: "#/components/schemas/LooseObject" } },
          },
        }),
        "400": jsonResponse("检测参数错误", {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [false] },
            error: { type: "string" },
          },
        }),
        "401": apiErrorResponse("未认证"),
        "500": jsonResponse("检测失败", {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [false] },
            error: { type: "string" },
          },
        }),
        "502": jsonResponse("上游检测接口异常", {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [false] },
            error: { type: "string" },
          },
        }),
        "503": apiErrorResponse("数据库未配置"),
      },
    },
  },
  "/qq-bot/generate-code": {
    post: {
      tags: ["Public"],
      summary: "QQ 机器人生成验证码",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["qqNumber"],
              properties: {
                qqNumber: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": jsonResponse("生成成功", {
          type: "object",
          properties: {
            success: { type: "boolean" },
            code: { type: "string" },
            expiryMinutes: { type: "integer" },
          },
        }),
        "400": legacyStringErrorResponse("参数错误"),
        "401": legacyStringErrorResponse("未授权"),
        "429": legacyStringErrorResponse("请求过于频繁"),
        "500": legacyStringErrorResponse("生成失败"),
        "503": legacyStringErrorResponse("机器人服务未配置"),
      },
    },
  },
  "/qq-groups": {
    get: {
      tags: ["Public"],
      summary: "获取启用的 QQ 群配置",
      responses: {
        "200": jsonResponse("QQ 群配置列表", {
          type: "array",
          items: { $ref: "#/components/schemas/QQGroup" },
        }),
      },
    },
  },
  "/qq-verify": {
    post: {
      tags: ["Public"],
      summary: "游客 QQ 验证入口（已关闭）",
      responses: {
        "403": legacyStringErrorResponse("游客提交已关闭"),
      },
    },
  },
  "/system-stats": {
    get: {
      tags: ["System"],
      summary: "获取系统统计摘要",
      responses: {
        "200": jsonResponse("系统统计", { $ref: "#/components/schemas/SystemStats" }),
      },
    },
  },
} as const

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
    schemas: {
      ApiError: apiErrorSchema,
      LegacyStringError: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string" },
          retryAfter: { type: "integer", nullable: true },
        },
      },
      LegacyNestedMessageError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["message"],
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
      LooseObject: {
        type: "object",
        additionalProperties: true,
      },
      AuthUser: {
        type: "object",
        required: ["id", "email", "role"],
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string", nullable: true },
          avatar: { type: "string", nullable: true },
          role: { type: "string" },
          linkedProviders: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      Passkey: {
        type: "object",
        required: ["id", "deviceType", "backedUp", "transports", "createdAt"],
        properties: {
          id: { type: "string" },
          credentialIdSuffix: { type: "string", nullable: true },
          deviceType: { type: "string", nullable: true },
          backedUp: { type: "boolean" },
          transports: {
            type: "array",
            items: { type: "string" },
          },
          createdAt: { type: "string", format: "date-time" },
          lastUsedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      DashboardMessage: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          readAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      DashboardPost: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          status: { type: "string" },
          views: { type: "integer", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      ChatMessage: {
        type: "object",
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          sender: { $ref: "#/components/schemas/AuthUser" },
          replyTo: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
        },
      },
      EmailApiConfig: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          host: { type: "string" },
          port: { type: "integer" },
          user: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ServiceInfo: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["up", "down", "degraded", "unconfigured"],
          },
          latency: { type: "integer", nullable: true },
        },
      },
      HealthBase: {
        type: "object",
        required: ["status", "timestamp", "uptime", "environment", "deployment"],
        properties: {
          status: { type: "string", enum: ["ok", "degraded", "down"] },
          timestamp: { type: "string", format: "date-time" },
          uptime: { type: "number" },
          environment: { type: "string", nullable: true },
          deployment: {
            type: "object",
            properties: {
              buildTime: { type: "string" },
              platform: { type: "string" },
              platformUrl: { type: "string" },
              git: {
                type: "object",
                properties: {
                  commitHash: { type: "string" },
                  commitShort: { type: "string" },
                  commitMessage: { type: "string" },
                  author: { type: "string" },
                  repo: { type: "string" },
                  branch: { type: "string" },
                },
              },
            },
          },
        },
      },
      HealthAdmin: {
        allOf: [
          { $ref: "#/components/schemas/HealthBase" },
          {
            type: "object",
            properties: {
              services: {
                type: "object",
                additionalProperties: { $ref: "#/components/schemas/ServiceInfo" },
              },
              runtime: {
                type: "object",
                properties: {
                  nodeVersion: { type: "string" },
                  memoryUsage: {
                    type: "object",
                    properties: {
                      rss: { type: "integer" },
                      heapUsed: { type: "integer" },
                      heapTotal: { type: "integer" },
                      external: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      BuildInfo: {
        type: "object",
        properties: {
          source: { type: "string" },
          fallback: { type: "boolean", nullable: true },
          buildTime: { type: "string" },
          commitHash: { type: "string" },
          commitHashShort: { type: "string" },
          commitTime: { type: "string", nullable: true },
          commitAuthor: { type: "string" },
          commitAuthorEmail: { type: "string", nullable: true },
          commitMessage: { type: "string", nullable: true },
          authorGitHub: { type: "string", nullable: true },
          authorAvatarUrl: { type: "string", nullable: true },
          commitUrl: { type: "string" },
          repoUrl: { type: "string" },
        },
      },
      SystemStats: {
        type: "object",
        required: ["users_count", "applications_count", "approved_count"],
        properties: {
          users_count: { type: "integer" },
          applications_count: { type: "integer" },
          approved_count: { type: "integer" },
        },
      },
      QQGroup: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          nameEn: { type: "string", nullable: true },
          number: { type: "string" },
          url: { type: "string" },
          enabled: { type: "boolean" },
          adminOnly: { type: "boolean", nullable: true },
        },
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
    { name: "System", description: "系统与状态接口" },
  ],
  paths: {
    // ── Auth ──
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "登录（密码或验证码）",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                      email: { type: "string", format: "email" },
                      password: { type: "string", minLength: 1 },
                      turnstileToken: { type: "string", nullable: true },
                      loginType: { type: "string", enum: ["password"], nullable: true },
                    },
                  },
                  {
                    type: "object",
                    required: ["email", "verificationCode", "loginType"],
                    properties: {
                      email: { type: "string", format: "email" },
                      verificationCode: { type: "string", minLength: 6, maxLength: 6 },
                      turnstileToken: { type: "string", nullable: true },
                      loginType: { type: "string", enum: ["code"] },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          "200": jsonResponse("登录成功", {
            type: "object",
            required: ["success", "user"],
            properties: {
              success: { type: "boolean" },
              user: { $ref: "#/components/schemas/AuthUser" },
            },
          }),
          "400": apiErrorResponse("参数错误或账号需重新激活"),
          "401": apiErrorResponse("凭据无效"),
          "403": apiErrorResponse("账号已封禁"),
          "500": apiErrorResponse("登录失败"),
          "503": apiErrorResponse("服务不可用"),
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
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string", nullable: true },
                  verificationCode: { type: "string", nullable: true },
                  turnstileToken: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": jsonResponse("注册成功", {
            type: "object",
            required: ["success", "user"],
            properties: {
              success: { type: "boolean" },
              user: { $ref: "#/components/schemas/AuthUser" },
            },
          }),
          "400": apiErrorResponse("参数错误"),
          "500": apiErrorResponse("注册失败"),
          "503": apiErrorResponse("服务不可用"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "登出并跳转登录页",
        responses: {
          "307": redirectResponse("清理会话后重定向到登录页"),
          "500": apiErrorResponse("登出失败"),
        },
      },
    },
    "/auth/session": {
      get: {
        tags: ["Auth"],
        summary: "获取当前会话",
        responses: {
          "200": jsonResponse("会话信息", {
            type: "object",
            required: ["user"],
            properties: {
              user: {
                anyOf: [{ $ref: "#/components/schemas/AuthUser" }, { type: "null" }],
              },
            },
          }),
          "500": apiErrorResponse("获取会话失败"),
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "获取当前用户信息",
        responses: {
          "200": jsonResponse("当前用户信息", {
            type: "object",
            required: ["user"],
            properties: {
              user: { $ref: "#/components/schemas/AuthUser" },
            },
          }),
          "401": apiErrorResponse("未登录"),
          "500": apiErrorResponse("获取用户信息失败"),
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
    "/admin/pre-applications/{id}/review-request": {
      post: {
        tags: ["Admin"],
        summary: "为已驳回预申请提交复审请求",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reason"],
                properties: {
                  reason: { type: "string", minLength: 1, maxLength: 2000 },
                  locale: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "复审请求创建成功" },
          "400": { description: "参数错误" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "申请不存在" },
          "409": { description: "申请状态不允许或已有待处理记录" },
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
                  applySubmitBan: { type: "boolean" },
                  submitBanDays: { type: "integer", minimum: 1 },
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

    "/admin/users/{id}/reapply": {
      post: {
        tags: ["Admin"],
        summary: "允许已通过用户重新提交预申请（仅超级管理员）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "已开放重新申请" },
          "400": { description: "当前状态不支持重新申请" },
          "401": { description: "未认证" },
          "403": { description: "无权限" },
          "404": { description: "用户不存在" },
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
                    preApplicationAppealEnabled: { type: "boolean" },
                    preApplicationAppealAutoRejectEnabled: { type: "boolean" },
                    preApplicationAppealAutoRejectPatterns: {
                      type: "array",
                      items: { type: "string" },
                    },
                    preApplicationAppealAutoRejectApplySubmitBan: { type: "boolean" },
                    preApplicationAppealAutoRejectSubmitBanDays: {
                      type: "integer",
                      minimum: 1,
                    },
                    newUserAnnouncementEnabled: { type: "boolean" },
                    newUserAnnouncementContent: { type: "string" },
                    newUserAnnouncementConfirmText: { type: "string" },
                    newUserAnnouncementDelaySeconds: { type: "integer", minimum: 0 },
                    newUserAnnouncementVersion: { type: "integer", minimum: 1 },
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
                    pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
                  },
                  preApplicationAppealEnabled: { type: "boolean" },
                  preApplicationAppealAutoRejectEnabled: { type: "boolean" },
                  preApplicationAppealAutoRejectPatterns: {
                    type: "array",
                    items: { type: "string" },
                  },
                  preApplicationAppealAutoRejectApplySubmitBan: { type: "boolean" },
                  preApplicationAppealAutoRejectSubmitBanDays: {
                    type: "integer",
                    minimum: 1,
                  },
                  newUserAnnouncementEnabled: { type: "boolean" },
                  newUserAnnouncementContent: { type: "string" },
                  newUserAnnouncementConfirmText: { type: "string" },
                  newUserAnnouncementDelaySeconds: { type: "integer", minimum: 0 },
                  newUserAnnouncementVersion: { type: "integer", minimum: 1 },
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
    "/admin/system-config/dashboard-user-announcement/retrigger": {
      post: {
        tags: ["Admin"],
        summary: "重新触发后台公告确认",
        responses: {
          "200": {
            description: "触发成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    newUserAnnouncementVersion: { type: "integer", minimum: 1 },
                  },
                },
              },
            },
          },
          "403": { description: "无权限" },
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
                    reapply: {
                      type: "object",
                      properties: {
                        eligible: { type: "boolean" },
                        started: { type: "boolean" },
                        canStart: { type: "boolean" },
                        eligibleAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        startedAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
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

    "/pre-application/reapply/start": {
      post: {
        tags: ["PreApplication"],
        summary: "开始新一轮预申请",
        responses: {
          "200": { description: "已进入重新申请流程" },
          "401": { description: "未认证" },
          "404": { description: "预申请记录不存在" },
          "409": { description: "当前状态不支持开始新申请" },
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
                          source: {
                            type: "string",
                            enum: ["USER_APPEAL", "ADMIN_REVIEW_REQUEST"],
                          },
                          initiatedById: { type: "string" },
                          status: { type: "string", enum: ["PENDING", "REJECTED", "OVERRIDDEN"] },
                          reason: { type: "string" },
                          reviewComment: { type: "string", nullable: true },
                          reviewedAt: { type: "string", format: "date-time", nullable: true },
                          submitBanApplied: { type: "boolean" },
                          submitBanDays: { type: "integer", nullable: true },
                          submitBanUntil: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                          autoRejected: { type: "boolean" },
                          autoRejectedPattern: { type: "string", nullable: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" },
                          initiatedBy: {
                            type: "object",
                            nullable: true,
                            properties: {
                              id: { type: "string" },
                              name: { type: "string", nullable: true },
                              email: { type: "string", nullable: true },
                            },
                          },
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

    // ── Synced latest paths ──
    ...latestAuthPaths,
    ...latestAdminPaths,
    ...latestDashboardPaths,
    ...latestChatPaths,
    ...latestPreApplicationPaths,
    ...latestPublicPaths,
  },
}
