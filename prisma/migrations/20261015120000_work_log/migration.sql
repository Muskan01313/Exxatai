-- CreateTable
CREATE TABLE "WorkLogEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL DEFAULT '',
    "stubName" TEXT NOT NULL DEFAULT '',
    "domain" TEXT NOT NULL DEFAULT '',
    "analyst" TEXT NOT NULL DEFAULT '',
    "workType" TEXT NOT NULL DEFAULT '',
    "mainCategory" TEXT NOT NULL DEFAULT '',
    "subCategory" TEXT NOT NULL DEFAULT '',
    "formComplexity" TEXT NOT NULL DEFAULT '',
    "completedCount" INTEGER,
    "usedByDate" TEXT,
    "workDate" TEXT NOT NULL,
    "comments" TEXT NOT NULL DEFAULT '',
    "vstsNumber" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "timerSeconds" INTEGER NOT NULL DEFAULT 0,
    "timerStartedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLogOptions" (
    "workspaceId" TEXT NOT NULL,
    "lists" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLogOptions_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE INDEX "WorkLogEntry_workspaceId_userId_submittedAt_idx" ON "WorkLogEntry"("workspaceId", "userId", "submittedAt");

-- CreateIndex
CREATE INDEX "WorkLogEntry_workspaceId_workDate_idx" ON "WorkLogEntry"("workspaceId", "workDate");

-- AddForeignKey
ALTER TABLE "WorkLogEntry" ADD CONSTRAINT "WorkLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLogEntry" ADD CONSTRAINT "WorkLogEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLogOptions" ADD CONSTRAINT "WorkLogOptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
