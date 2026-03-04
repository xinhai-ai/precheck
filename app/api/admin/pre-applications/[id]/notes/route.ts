import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  canManagePreApplicationAdminNote,
  type PreApplicationAdminRole,
  normalizePreApplicationAdminNoteContent,
} from "@/lib/pre-application/admin-note-utils"

const createNoteSchema = z.object({
  content: z.string(),
})

type DbTransaction = Parameters<NonNullable<typeof db>["$transaction"]>[0] extends (
  prisma: infer T,
  ...args: never[]
) => unknown
  ? T
  : never

function toNoteRecord(
  note: {
    id: string
    content: string
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    createdById: string
    createdBy: { id: string; name: string | null; email: string }
    updatedBy: { id: string; name: string | null; email: string }
    revisions: Array<{
      id: string
      action: "CREATED" | "UPDATED" | "DELETED"
      content: string
      createdAt: Date
      editedBy: { id: string; name: string | null; email: string }
    }>
  },
  actor: { id: string; role: PreApplicationAdminRole },
) {
  const canManage = canManagePreApplicationAdminNote({
    actorRole: actor.role,
    actorId: actor.id,
    createdById: note.createdById,
  })

  return {
    id: note.id,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    createdBy: note.createdBy,
    updatedBy: note.updatedBy,
    revisions: note.revisions,
    canEdit: canManage,
    canDelete: canManage,
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params

    const preApplication = await db.preApplication.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!preApplication) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    const notes = await db.preApplicationAdminNote.findMany({
      where: {
        preApplicationId: id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        revisions: {
          orderBy: { createdAt: "desc" },
          include: {
            editedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    const actor = { id: user.id, role: user.role as PreApplicationAdminRole }

    return NextResponse.json({
      records: notes.map((note: Parameters<typeof toNoteRecord>[0]) => toNoteRecord(note, actor)),
    })
  } catch (error) {
    console.error("Admin pre-application notes list error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.notes.failedToFetch, {
      status: 500,
    })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params
    const body = await request.json()
    const data = createNoteSchema.parse(body)

    const normalizedContent = normalizePreApplicationAdminNoteContent(data.content)
    if (!normalizedContent) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: `content length must be 1..2000 after trim` },
      })
    }

    const preApplication = await db.preApplication.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!preApplication) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    const created = await db.$transaction(async (tx: DbTransaction) => {
      const note = await tx.preApplicationAdminNote.create({
        data: {
          preApplicationId: id,
          content: normalizedContent,
          createdById: user.id,
          updatedById: user.id,
        },
      })

      const revision = await tx.preApplicationAdminNoteRevision.create({
        data: {
          noteId: note.id,
          action: "CREATED",
          content: normalizedContent,
          editedById: user.id,
        },
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_NOTE_CREATE",
        entityType: "PRE_APPLICATION_ADMIN_NOTE",
        entityId: note.id,
        actor: user,
        after: note,
        metadata: {
          preApplicationId: id,
          noteId: note.id,
          revisionId: revision.id,
        },
        request,
      })

      return note
    })

    const note = await db.preApplicationAdminNote.findUnique({
      where: { id: created.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        revisions: {
          orderBy: { createdAt: "desc" },
          include: {
            editedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    if (!note) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.notes.notFound, {
        status: 404,
      })
    }

    return NextResponse.json({
      record: toNoteRecord(note, { id: user.id, role: user.role as PreApplicationAdminRole }),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0]?.message || "Invalid payload" },
      })
    }

    console.error("Admin pre-application note create error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.preApplications.notes.failedToCreate,
      {
        status: 500,
      },
    )
  }
}
