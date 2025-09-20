-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ValueType" AS ENUM ('NUMBER', 'STRING', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "StatusLogAction" AS ENUM ('INACTIVE', 'ACTIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGINT NOT NULL,
    "userName" VARCHAR(255),
    "photoUrl" VARCHAR(255),
    "payloadCell" VARCHAR(255) NOT NULL,
    "isBan" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "pointCurrent" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configs" (
    "key" VARCHAR(255) NOT NULL,
    "valueType" "ValueType" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "log_actions" (
    "id" BIGSERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "body" TEXT NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "query" TEXT NOT NULL,
    "now" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" TEXT NOT NULL,
    "timeCall" INTEGER NOT NULL,
    "status" "StatusLogAction" NOT NULL,
    "userId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_actions_pkey" PRIMARY KEY ("id")
);
