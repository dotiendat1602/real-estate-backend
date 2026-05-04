import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

type WardSource = {
  name: string;
  code?: number | string;
};

type DistrictSource = {
  name: string;
  code?: number | string;
  wards?: WardSource[];
};

type ProvinceSource = {
  name: string;
  code?: number | string;
  districts?: DistrictSource[];
};

const DEFAULT_SOURCE_URL = 'https://provinces.open-api.vn/api/v1/?depth=3';

const prisma = new PrismaClient();

type LocationRow = {
  id: number;
  name: string;
};

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^((tinh|thanh pho|tp\.?)\s+)/, '')
    .replace(/^((quan|huyen|thi xa|thanh pho|tp\.?)\s+)/, '')
    .replace(/^((phuong|xa|thi tran)\s+)/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadSource(): Promise<ProvinceSource[]> {
  const source = process.env.VIETNAM_LOCATION_SOURCE || DEFAULT_SOURCE_URL;

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch location source: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<ProvinceSource[]>;
  }

  const filePath = path.isAbsolute(source)
    ? source
    : path.resolve(process.cwd(), source);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content) as ProvinceSource[];
}

function buildLocationMap(rows: LocationRow[]) {
  return new Map(rows.map((row) => [normalizeName(row.name), row]));
}

async function main() {
  const source = process.env.VIETNAM_LOCATION_SOURCE || DEFAULT_SOURCE_URL;
  const provinces = await loadSource();
  if (!Array.isArray(provinces) || provinces.length === 0) {
    throw new Error('Location source is empty or invalid');
  }

  const provinceByName = buildLocationMap(
    await prisma.province.findMany({
      select: { id: true, name: true },
    }),
  );

  let createdProvinces = 0;
  let updatedProvinces = 0;
  let createdDistricts = 0;
  let updatedDistricts = 0;
  let createdWards = 0;
  let updatedWards = 0;

  for (const province of provinces) {
    if (!province.name) continue;

    const provinceKey = normalizeName(province.name);
    const existingProvince = provinceByName.get(provinceKey);
    const provinceRecord = existingProvince
      ? await prisma.province.update({
          where: { id: existingProvince.id },
          data: { name: province.name },
        })
      : await prisma.province.create({
          data: { name: province.name },
        });

    if (existingProvince) updatedProvinces += 1;
    else createdProvinces += 1;

    provinceByName.set(provinceKey, {
      id: provinceRecord.id,
      name: provinceRecord.name,
    });

    const districtByName = buildLocationMap(
      await prisma.district.findMany({
        where: { provinceId: provinceRecord.id },
        select: { id: true, name: true },
      }),
    );

    for (const district of province.districts ?? []) {
      if (!district.name) continue;

      const districtKey = normalizeName(district.name);
      const existingDistrict = districtByName.get(districtKey);
      const districtRecord = existingDistrict
        ? await prisma.district.update({
            where: { id: existingDistrict.id },
            data: { name: district.name, provinceId: provinceRecord.id },
          })
        : await prisma.district.create({
            data: { name: district.name, provinceId: provinceRecord.id },
          });

      if (existingDistrict) updatedDistricts += 1;
      else createdDistricts += 1;

      districtByName.set(districtKey, {
        id: districtRecord.id,
        name: districtRecord.name,
      });

      const wardByName = buildLocationMap(
        await prisma.ward.findMany({
          where: { districtId: districtRecord.id },
          select: { id: true, name: true },
        }),
      );

      for (const ward of district.wards ?? []) {
        if (!ward.name) continue;

        const wardKey = normalizeName(ward.name);
        const existingWard = wardByName.get(wardKey);
        if (existingWard) {
          const wardRecord = await prisma.ward.update({
            where: { id: existingWard.id },
            data: { name: ward.name, districtId: districtRecord.id },
          });
          wardByName.set(wardKey, {
            id: wardRecord.id,
            name: wardRecord.name,
          });
          updatedWards += 1;
        } else {
          const wardRecord = await prisma.ward.create({
            data: { name: ward.name, districtId: districtRecord.id },
          });
          wardByName.set(wardKey, {
            id: wardRecord.id,
            name: wardRecord.name,
          });
          createdWards += 1;
        }
      }
    }
  }

  console.log('Vietnam locations import finished');
  console.log({
    source,
    createdProvinces,
    updatedProvinces,
    createdDistricts,
    updatedDistricts,
    createdWards,
    updatedWards,
  });
}

main()
  .catch((error) => {
    console.error('Vietnam locations import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
