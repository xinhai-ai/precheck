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

const updateNoteSchema = z.object({
  content: z.string(),
})

type DbTransaction = Parameters<NonNullable<typeof db>["$transaction"]>[0] extends (
  prisma: infer T,
  ...args: never[]
) => unknown
  ? T
  : never

function canManageNote(input: {
  actorRole: PreApplicationAdminRole
  actorId: string
  createdById: string
}): boolean {
  return canManagePreApplicationAdminNote(input)
}

function noteDetailInclude() {
  return {
    createdBy: { select: { id: true, name: true, email: true } },
    updatedBy: { select: { id: true, name: true, email: true } },
    revisions: {
      orderBy: { createdAt: "desc" as const },
      include: {
        editedBy: { select: { id: true, name: true, email: true } },
      },
    },
  }
}

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
  const canManage = canManageNote({
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
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

    const { id, noteId } = await context.params
    const body = await request.json()
    const data = updateNoteSchema.parse(body)

    const normalizedContent = normalizePreApplicationAdminNoteContent(data.content)
    if (!normalizedContent) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: `content length must be 1..2000 after trim` },
      })
    }

    const note = await db.preApplicationAdminNote.findFirst({
      where: {
        id: noteId,
        preApplicationId: id,
      },
      select: {
        id: true,
        preApplicationId: true,
        content: true,
        createdById: true,
        updatedById: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!note) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.notes.notFound, {
        status: 404,
      })
    }

    if (note.deletedAt) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.admin.preApplications.notes.alreadyDeleted,
        { status: 409 },
      )
    }

    const actorRole = user.role as PreApplicationAdminRole
    if (
      !canManageNote({
        actorRole,
        actorId: user.id,
        createdById: note.createdById,
      })
    ) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.admin.preApplications.notes.permissionDenied,
        { status: 403 },
      )
    }

    if (note.content !== normalizedContent) {
      await db.$transaction(async (tx: DbTransaction) => {
        const updated = await tx.preApplicationAdminNote.update({
          where: { id: note.id },
          data: {
            content: normalizedContent,
            updatedById: user.id,
          },
        })

        const revision = await tx.preApplicationAdminNoteRevision.create({
          data: {
            noteId: note.id,
            action: "UPDATED",
            content: normalizedContent,
            editedById: user.id,
          },
        })

        await writeAuditLog(tx, {
          action: "PRE_APPLICATION_NOTE_UPDATE",
          entityType: "PRE_APPLICATION_ADMIN_NOTE",
          entityId: note.id,
          actor: user,
          before: note,
          after: updated,
          metadata: {
            preApplicationId: id,
            noteId: note.id,
            revisionId: revision.id,
          },
          request,
        })
      })
    }

    const detail = await db.preApplicationAdminNote.findUnique({
      where: { id: note.id },
      include: noteDetailInclude(),
    })

    if (!detail) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.notes.notFound, {
        status: 404,
      })
    }

    return NextResponse.json({
      record: toNoteRecord(detail, {
        id: user.id,
        role: actorRole,
      }),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0]?.message || "Invalid payload" },
      })
    }

    console.error("Admin pre-application note update error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.preApplications.notes.failedToUpdate,
      {
        status: 500,
      },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
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

    const { id, noteId } = await context.params

    const note = await db.preApplicationAdminNote.findFirst({
      where: {
        id: noteId,
        preApplicationId: id,
      },
      select: {
        id: true,
        preApplicationId: true,
        content: true,
        createdById: true,
        updatedById: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!note) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.notes.notFound, {
        status: 404,
      })
    }

    if (note.deletedAt) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.admin.preApplications.notes.alreadyDeleted,
        { status: 409 },
      )
    }

    const actorRole = user.role as PreApplicationAdminRole
    if (
      !canManageNote({
        actorRole,
        actorId: user.id,
        createdById: note.createdById,
      })
    ) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.admin.preApplications.notes.permissionDenied,
        { status: 403 },
      )
    }

    const deletedAt = new Date()

    await db.$transaction(async (tx: DbTransaction) => {
      const updated = await tx.preApplicationAdminNote.update({
        where: { id: note.id },
        data: {
          deletedAt,
          updatedById: user.id,
        },
      })

      const revision = await tx.preApplicationAdminNoteRevision.create({
        data: {
          noteId: note.id,
          action: "DELETED",
          content: note.content,
          editedById: user.id,
        },
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_NOTE_DELETE",
        entityType: "PRE_APPLICATION_ADMIN_NOTE",
        entityId: note.id,
        actor: user,
        before: note,
        after: updated,
        metadata: {
          preApplicationId: id,
          noteId: note.id,
          revisionId: revision.id,
        },
        request,
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin pre-application note delete error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.preApplications.notes.failedToDelete,
      {
        status: 500,
      },
    )
  }
}
