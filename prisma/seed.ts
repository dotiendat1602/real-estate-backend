import {
  PrismaClient,
  Prisma,
  RoleType,
  SystemPermissionType,
  Status,
  AmenityCategory,
  UtilityCategory,
  FurnitureStatus,
  LegalStatus,
  PostStatus,
  PostType,
  LeadStatus,
  AppointmentStatus,
  DepositStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // -------------------------------------------------------
  // 1. Seed Permissions
  // -------------------------------------------------------
  const allPermissionEnums = Object.values(SystemPermissionType);

  for (const perm of allPermissionEnums) {
    await prisma.permission.upsert({
      where: { name: perm },
      update: {},
      create: { name: perm },
    });
  }
  console.log('Seeded permissions');

  const allPermissions = await prisma.permission.findMany();

  const getPermissionId = (name: SystemPermissionType) => {
    const p = allPermissions.find((perm) => perm.name === name);
    if (!p) throw new Error(`Permission not found: ${name}`);
    return p.permission_id;
  };

  // -------------------------------------------------------
  // 2. Seed Roles
  // -------------------------------------------------------
  const rolesData = [
    {
      name: RoleType.ADMIN,
      description: 'System administrator - full access',
    },
    {
      name: RoleType.MANAGER,
      description: 'Branch / team manager - limited management',
    },
    {
      name: RoleType.AGENT,
      description: 'Agent / broker - handle posts, leads, chat, appointments',
    },
    {
      name: RoleType.USER,
      description: 'Normal user - basic usage',
    },
  ];

  for (const role of rolesData) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
      },
      create: {
        name: role.name,
        description: role.description,
      },
    });
  }
  console.log('Seeded roles');

  const adminRole = await prisma.role.findUnique({
    where: { name: RoleType.ADMIN },
  });
  const managerRole = await prisma.role.findUnique({
    where: { name: RoleType.MANAGER },
  });
  const agentRole = await prisma.role.findUnique({
    where: { name: RoleType.AGENT },
  });
  const userRole = await prisma.role.findUnique({
    where: { name: RoleType.USER },
  });

  if (!adminRole || !managerRole || !agentRole || !userRole) {
    throw new Error('Some roles not found after seeding');
  }

  // -------------------------------------------------------
  // 3. Gán Permissions cho từng Role
  // -------------------------------------------------------
  const adminPermissionIds = allPermissionEnums.map((p) =>
    getPermissionId(p as SystemPermissionType),
  );

  const managerPermissionEnums: SystemPermissionType[] = [
    SystemPermissionType.MANAGE_PROPERTY,
    SystemPermissionType.MANAGE_POST,
    SystemPermissionType.MANAGE_CATEGORY,
    SystemPermissionType.MANAGE_AMENITIES,
    SystemPermissionType.MANAGE_PAYMENT,
    SystemPermissionType.MANAGE_LEADS,
    SystemPermissionType.MANAGE_CHAT,
    SystemPermissionType.MANAGE_APPOINTMENT,
  ];
  const managerPermissionIds = managerPermissionEnums.map(getPermissionId);

  const agentPermissionEnums: SystemPermissionType[] = [
    SystemPermissionType.MANAGE_PROPERTY,
    SystemPermissionType.MANAGE_POST,
    SystemPermissionType.MANAGE_LEADS,
    SystemPermissionType.MANAGE_CHAT,
    SystemPermissionType.MANAGE_APPOINTMENT,
  ];
  const agentPermissionIds = agentPermissionEnums.map(getPermissionId);

  // USER: tuỳ business, bạn có thể giảm quyền (hiện seed bạn đang cho khá mạnh).
  // Mình giữ nguyên theo seed gốc của bạn để tránh thay đổi behavior.
  const userPermissionEnums: SystemPermissionType[] = [
    SystemPermissionType.MANAGE_PROPERTY,
    SystemPermissionType.MANAGE_POST,
  ];
  const userPermissionIds = userPermissionEnums.map(getPermissionId);

  async function assignPermissionsToRole(
    roleId: number,
    permissionIds: number[],
  ) {
    for (const permId of permissionIds) {
      await prisma.rolesPermissions.upsert({
        where: {
          role_id_permission_id: {
            role_id: roleId,
            permission_id: permId,
          },
        },
        update: {},
        create: {
          role_id: roleId,
          permission_id: permId,
        },
      });
    }
  }

  await assignPermissionsToRole(adminRole.role_id, adminPermissionIds);
  await assignPermissionsToRole(managerRole.role_id, managerPermissionIds);
  await assignPermissionsToRole(agentRole.role_id, agentPermissionIds);
  await assignPermissionsToRole(userRole.role_id, userPermissionIds);

  console.log('Assigned permissions to roles');

  // -------------------------------------------------------
  // 4. Users: admin + 1 agent + 1 user thường
  // -------------------------------------------------------
  const adminEmail = 'admin@example.com';

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Default Admin',
      password: bcrypt.hashSync('Password@123', 10),
      phone: '0900000000',
      role_id: adminRole.role_id,
      status: Status.ACTIVE,
    },
  });

  const agentEmail = 'agent@example.com';

  const agentUser = await prisma.user.upsert({
    where: { email: agentEmail },
    update: {},
    create: {
      email: agentEmail,
      name: 'Default Agent',
      password: bcrypt.hashSync('Password@123', 10),
      phone: '0900000002',
      role_id: agentRole.role_id,
      status: Status.ACTIVE,
    },
  });

  const normalUserEmail = 'user@example.com';

  const normalUser = await prisma.user.upsert({
    where: { email: normalUserEmail },
    update: {},
    create: {
      email: normalUserEmail,
      name: 'Default User',
      password: bcrypt.hashSync('Password@123', 10),
      phone: '0900000001',
      role_id: userRole.role_id,
      status: Status.ACTIVE,
    },
  });

  console.log('Seeded users');

  // -------------------------------------------------------
  // 5. Property Categories
  // -------------------------------------------------------
  const categorySeeds = [
    {
      category_name: 'Căn hộ',
      category_description: 'Căn hộ chung cư, condotel...',
    },
    {
      category_name: 'Nhà phố',
      category_description: 'Nhà phố, nhà hẻm, nhà mặt tiền...',
    },
    {
      category_name: 'Đất nền',
      category_description: 'Đất nền, đất thổ cư, đất dự án...',
    },
  ];

  for (const cat of categorySeeds) {
    await prisma.propertyCategory.upsert({
      where: { category_name: cat.category_name },
      update: {
        category_description: cat.category_description,
      },
      create: {
        category_name: cat.category_name,
        category_description: cat.category_description,
      },
    });
  }

  const apartmentCategory = await prisma.propertyCategory.findUnique({
    where: { category_name: 'Căn hộ' },
  });
  const houseCategory = await prisma.propertyCategory.findUnique({
    where: { category_name: 'Nhà phố' },
  });

  if (!apartmentCategory || !houseCategory) {
    throw new Error('Some property categories not found');
  }

  console.log('Seeded property categories');

  // -------------------------------------------------------
  // 6. Seed Location: Province / District / Ward
  // -------------------------------------------------------
  let hcm = await prisma.province.findFirst({
    where: { name: 'Hồ Chí Minh' },
  });
  if (!hcm) {
    hcm = await prisma.province.create({
      data: { name: 'Hồ Chí Minh' },
    });
  }

  let district1 = await prisma.district.findFirst({
    where: { name: 'Quận 1', province_id: hcm.province_id },
  });
  if (!district1) {
    district1 = await prisma.district.create({
      data: {
        name: 'Quận 1',
        province_id: hcm.province_id,
      },
    });
  }

  let benNgheWard = await prisma.ward.findFirst({
    where: { name: 'Phường Bến Nghé', district_id: district1.district_id },
  });
  if (!benNgheWard) {
    benNgheWard = await prisma.ward.create({
      data: {
        name: 'Phường Bến Nghé',
        district_id: district1.district_id,
      },
    });
  }

  console.log('Seeded location (HCM - Q1 - P. Bến Nghé)');

  // -------------------------------------------------------
  // 7. Seed Amenities
  // -------------------------------------------------------
  const amenitySeeds: { name: string; category: AmenityCategory }[] = [
    { name: 'Máy lạnh', category: AmenityCategory.INTERIOR },
    { name: 'Tủ âm tường', category: AmenityCategory.INTERIOR },
    { name: 'Ban công', category: AmenityCategory.EXTERIOR },
    { name: 'Hồ bơi', category: AmenityCategory.COMMUNITY },
    { name: 'Phòng gym', category: AmenityCategory.COMMUNITY },
    { name: 'Thang máy', category: AmenityCategory.ACCESSIBILITY },
    { name: 'Camera an ninh', category: AmenityCategory.SECURITY },
    { name: 'Khóa từ', category: AmenityCategory.SMART_HOME },
    { name: 'Bãi giữ xe ô tô', category: AmenityCategory.PARKING },
    { name: 'Bếp âm', category: AmenityCategory.KITCHEN },
    { name: 'Máy rửa chén', category: AmenityCategory.KITCHEN },
    { name: 'Bồn tắm', category: AmenityCategory.BATHROOM },
  ];

  for (const a of amenitySeeds) {
    await prisma.amenity.upsert({
      where: { name: a.name },
      update: { category: a.category },
      create: {
        name: a.name,
        category: a.category,
      },
    });
  }

  const amenities = await prisma.amenity.findMany();
  console.log('Seeded amenities');

  // -------------------------------------------------------
  // 8. Seed Utilities (POI xung quanh)
  // -------------------------------------------------------
  async function getOrCreateUtility(data: {
    utility_category: UtilityCategory;
    utility_name: string;
    lat?: string;
    lon?: string;
    location?: string;
    province_id?: number;
    district_id?: number;
    ward_id?: number;
  }) {
    const found = await prisma.utility.findFirst({
      where: {
        utility_category: data.utility_category,
        utility_name: data.utility_name,
        province_id: data.province_id,
        district_id: data.district_id,
        ward_id: data.ward_id,
      },
    });

    if (found) return found;

    return prisma.utility.create({
      data: {
        utility_category: data.utility_category,
        utility_name: data.utility_name,
        lat: data.lat ? new Prisma.Decimal(data.lat) : undefined,
        lon: data.lon ? new Prisma.Decimal(data.lon) : undefined,
        location: data.location,
        province_id: data.province_id,
        district_id: data.district_id,
        ward_id: data.ward_id,
      },
    });
  }

  const utilitySeeds = [
    {
      utility_category: UtilityCategory.EDUCATION,
      utility_name: 'Trường THPT Lê Quý Đôn',
      lat: '10.779600',
      lon: '106.699500',
      location: 'Quận 3, TP. HCM',
    },
    {
      utility_category: UtilityCategory.HEALTHCARE,
      utility_name: 'Bệnh viện Nhi Đồng 2',
      lat: '10.783800',
      lon: '106.700200',
      location: 'Quận 1, TP. HCM',
    },
    {
      utility_category: UtilityCategory.COMMERCIAL_SHOPPING,
      utility_name: 'Vincom Đồng Khởi',
      lat: '10.776900',
      lon: '106.704300',
      location: '72 Lê Thánh Tôn, Quận 1, TP. HCM',
    },
    {
      utility_category: UtilityCategory.PARK_PLAZA,
      utility_name: 'Công viên 30/4',
      lat: '10.779300',
      lon: '106.699800',
      location: 'Quận 1, TP. HCM',
    },
    {
      utility_category: UtilityCategory.FINANCIAL,
      utility_name: 'Ngân hàng Vietcombank Chi nhánh Sài Gòn',
      lat: '10.776000',
      lon: '106.701000',
      location: 'Quận 1, TP. HCM',
    },
  ];

  const utilities: any = [];
  for (const u of utilitySeeds) {
    const created = await getOrCreateUtility({
      ...u,
      province_id: hcm.province_id,
      district_id: district1.district_id,
      ward_id: benNgheWard.ward_id,
    });
    utilities.push(created);
  }

  console.log('Seeded utilities');

  // -------------------------------------------------------
  // 9. Seed Properties
  // -------------------------------------------------------
  async function getOrCreateProperty(where: {
    title: string;
    owner_id: number;
  }) {
    const found = await prisma.property.findFirst({
      where: {
        title: where.title,
        owner_id: where.owner_id,
      },
    });
    if (found) return found;
    return null;
  }

  // Căn hộ cao cấp Quận 1
  let apartment1 = await getOrCreateProperty({
    title: 'Căn hộ 2PN cao cấp Quận 1, view sông',
    owner_id: adminUser.user_id,
  });

  if (!apartment1) {
    apartment1 = await prisma.property.create({
      data: {
        title: 'Căn hộ 2PN cao cấp Quận 1, view sông',
        description:
          'Căn hộ 2 phòng ngủ, full nội thất, view sông Sài Gòn, nằm trong khu phức hợp cao cấp trung tâm Quận 1.',
        price: new Prisma.Decimal('6500000000.00'),
        area: new Prisma.Decimal('75.00'),
        bedroomNumber: 2,
        toiletNumber: 2,
        floorNumber: 20,
        parking: true,
        orientation: 'Đông Nam',
        frontage: new Prisma.Decimal('6.00'),
        roadWidth: new Prisma.Decimal('12.00'),
        furnitureStatus: FurnitureStatus.FULLY_FURNISHED,
        legalStatus: LegalStatus.PINK_BOOK,
        yearBuilt: 2019,
        lat: new Prisma.Decimal('10.780000'),
        lon: new Prisma.Decimal('106.705000'),
        location: 'Quận 1, TP. Hồ Chí Minh',
        category_id: apartmentCategory.category_id,
        owner_id: adminUser.user_id,
        ward_id: benNgheWard.ward_id,
        district_id: district1.district_id,
        province_id: hcm.province_id,
        status: Status.ACTIVE,
      },
    });
  }

  // Nhà phố Quận 1
  let house1 = await getOrCreateProperty({
    title: 'Nhà phố 4x18m trung tâm Quận 1, phù hợp kinh doanh',
    owner_id: normalUser.user_id,
  });

  if (!house1) {
    house1 = await prisma.property.create({
      data: {
        title: 'Nhà phố 4x18m trung tâm Quận 1, phù hợp kinh doanh',
        description:
          'Nhà phố 1 trệt 3 lầu, mặt tiền đường lớn, thích hợp mở văn phòng, spa, showroom.',
        price: new Prisma.Decimal('19500000000.00'),
        area: new Prisma.Decimal('72.00'),
        bedroomNumber: 4,
        toiletNumber: 4,
        floorNumber: 4,
        parking: true,
        orientation: 'Tây Bắc',
        frontage: new Prisma.Decimal('4.00'),
        roadWidth: new Prisma.Decimal('20.00'),
        furnitureStatus: FurnitureStatus.PARTLY_FURNISHED,
        legalStatus: LegalStatus.RED_BOOK,
        yearBuilt: 2015,
        lat: new Prisma.Decimal('10.776500'),
        lon: new Prisma.Decimal('106.701500'),
        location: 'Mặt tiền đường trung tâm Quận 1, TP. Hồ Chí Minh',
        category_id: houseCategory.category_id,
        owner_id: normalUser.user_id,
        ward_id: benNgheWard.ward_id,
        district_id: district1.district_id,
        province_id: hcm.province_id,
        status: Status.ACTIVE,
      },
    });
  }

  console.log('Seeded properties');

  // -------------------------------------------------------
  // 10. Seed PropertyAmenities
  // -------------------------------------------------------
  const findAmenity = (name: string) =>
    amenities.find((a) => a.name === name);

  const apartmentAmenities = [
    'Máy lạnh',
    'Tủ âm tường',
    'Ban công',
    'Hồ bơi',
    'Phòng gym',
    'Thang máy',
    'Camera an ninh',
    'Khóa từ',
    'Bãi giữ xe ô tô',
  ];

  for (const name of apartmentAmenities) {
    const amenity = findAmenity(name);
    if (!amenity) continue;
    await prisma.propertyAmenity.upsert({
      where: {
        property_id_amenity_id: {
          property_id: apartment1.property_id,
          amenity_id: amenity.amenity_id,
        },
      },
      update: {},
      create: {
        property_id: apartment1.property_id,
        amenity_id: amenity.amenity_id,
      },
    });
  }

  const houseAmenities = [
    'Máy lạnh',
    'Ban công',
    'Bồn tắm',
    'Bãi giữ xe ô tô',
    'Camera an ninh',
  ];

  for (const name of houseAmenities) {
    const amenity = findAmenity(name);
    if (!amenity) continue;
    await prisma.propertyAmenity.upsert({
      where: {
        property_id_amenity_id: {
          property_id: house1.property_id,
          amenity_id: amenity.amenity_id,
        },
      },
      update: {},
      create: {
        property_id: house1.property_id,
        amenity_id: amenity.amenity_id,
      },
    });
  }

  console.log('Seeded property amenities');

  // -------------------------------------------------------
  // 11. Seed PropertyUtilities
  // -------------------------------------------------------
  const apartmentUtilityPairs = [
    {
      property_id: apartment1.property_id,
      utility_name: 'Vincom Đồng Khởi',
      distance_m: '1200.00',
      travel_time_s: 300,
      is_primary: true,
    },
    {
      property_id: apartment1.property_id,
      utility_name: 'Trường THPT Lê Quý Đôn',
      distance_m: '2300.00',
      travel_time_s: 600,
      is_primary: false,
    },
    {
      property_id: apartment1.property_id,
      utility_name: 'Công viên 30/4',
      distance_m: '800.00',
      travel_time_s: 240,
      is_primary: false,
    },
  ];

  const houseUtilityPairs = [
    {
      property_id: house1.property_id,
      utility_name: 'Ngân hàng Vietcombank Chi nhánh Sài Gòn',
      distance_m: '300.00',
      travel_time_s: 120,
      is_primary: true,
    },
    {
      property_id: house1.property_id,
      utility_name: 'Bệnh viện Nhi Đồng 2',
      distance_m: '1500.00',
      travel_time_s: 420,
      is_primary: false,
    },
  ];

  function findUtilityByName(name: string) {
    return utilities.find((u: any) => u.utility_name === name);
  }

  const allPairs = [...apartmentUtilityPairs, ...houseUtilityPairs];

  for (const pair of allPairs) {
    const utility = findUtilityByName(pair.utility_name);
    if (!utility) continue;

    await prisma.propertyUtility.upsert({
      where: {
        property_id_utility_id: {
          property_id: pair.property_id,
          utility_id: utility.utility_id,
        },
      },
      update: {
        distance_m: new Prisma.Decimal(pair.distance_m),
        travel_time_s: pair.travel_time_s,
        is_primary: pair.is_primary,
      },
      create: {
        property_id: pair.property_id,
        utility_id: utility.utility_id,
        distance_m: new Prisma.Decimal(pair.distance_m),
        travel_time_s: pair.travel_time_s,
        is_primary: pair.is_primary,
      },
    });
  }

  console.log('Seeded property utilities');

  // -------------------------------------------------------
  // 12. Seed Posts demo + Slugs + Leads + Conversations
  // -------------------------------------------------------
  const now = new Date();

  async function getPostByTitleAndProperty(
    postTitle: string,
    property_id: number,
  ) {
    return prisma.post.findFirst({
      where: { postTitle, property_id },
    });
  }

  // Post 1: Bài bán căn hộ (APPROVED + PUBLISHED)
  let postApartmentSale = await getPostByTitleAndProperty(
    'Bán căn hộ 2PN Quận 1, full nội thất',
    apartment1.property_id,
  );

  if (!postApartmentSale) {
    postApartmentSale = await prisma.post.create({
      data: {
        property_id: apartment1.property_id,
        postTitle: 'Bán căn hộ 2PN Quận 1, full nội thất',
        postType: PostType.SALE,
        postContent:
          'Bán căn hộ 2 phòng ngủ, full nội thất cao cấp, view sông, ngay trung tâm Quận 1. Tiện ích nội khu đầy đủ: hồ bơi, gym, siêu thị, an ninh 24/7.',
        postStatus: PostStatus.APPROVED,
        approvedById: adminUser.user_id,
        approvedAt: now,
        publishedAt: now,
        createdById: agentUser.user_id,
      },
    });
  }

  // Post 2: Bài cho thuê căn hộ (PENDING)
  let postApartmentRent = await getPostByTitleAndProperty(
    'Cho thuê căn hộ 2PN Quận 1, đầy đủ tiện ích',
    apartment1.property_id,
  );

  if (!postApartmentRent) {
    postApartmentRent = await prisma.post.create({
      data: {
        property_id: apartment1.property_id,
        postTitle: 'Cho thuê căn hộ 2PN Quận 1, đầy đủ tiện ích',
        postType: PostType.RENT,
        postContent:
          'Cho thuê căn hộ 2 phòng ngủ, nội thất cơ bản, free sử dụng hồ bơi và phòng gym. Phù hợp gia đình trẻ hoặc chuyên gia nước ngoài.',
        postStatus: PostStatus.PENDING,
        createdById: agentUser.user_id,
      },
    });
  }

  // Post 3: Bài nhà phố (DRAFT)
  let postHouseDraft = await getPostByTitleAndProperty(
    'Nhà phố mặt tiền Quận 1, đang update thông tin',
    house1.property_id,
  );

  if (!postHouseDraft) {
    postHouseDraft = await prisma.post.create({
      data: {
        property_id: house1.property_id,
        postTitle: 'Nhà phố mặt tiền Quận 1, đang update thông tin',
        postType: PostType.SALE,
        postContent:
          'Bài viết nháp cho nhà phố mặt tiền, sẽ cập nhật đầy đủ thông tin sau.',
        postStatus: PostStatus.DRAFT,
        createdById: agentUser.user_id,
      },
    });
  }

  console.log('Seeded posts demo');

  // -------------------------------------------------------
  // 13. Seed PostSlug cho các bài
  // -------------------------------------------------------
  async function ensurePostSlug(
    postId: number,
    slug: string,
    isCurrent = true,
  ) {
    await prisma.postSlug.upsert({
      where: { slug },
      update: { post_id: postId, isCurrent },
      create: {
        post_id: postId,
        slug,
        isCurrent,
      },
    });
  }

  await ensurePostSlug(
    postApartmentSale.post_id,
    'ban-can-ho-2pn-quan-1-full-noi-that',
    true,
  );
  await ensurePostSlug(
    postApartmentRent.post_id,
    'cho-thue-can-ho-2pn-quan-1-day-du-tien-ich',
    true,
  );
  await ensurePostSlug(
    postHouseDraft.post_id,
    'nha-pho-mat-tien-quan-1-dang-update',
    true,
  );

  console.log('Seeded post slugs');

  // -------------------------------------------------------
  // 14. Seed Lead demo
  // -------------------------------------------------------
  let lead1 = await prisma.lead.findFirst({
    where: {
      post_id: postApartmentSale.post_id,
      phone: '0900000001',
    },
  });

  if (!lead1) {
    lead1 = await prisma.lead.create({
      data: {
        post_id: postApartmentSale.post_id,
        buyerId: normalUser.user_id,
        name: normalUser.name ?? 'Khách mua 1',
        email: normalUser.email,
        phone: '0900000001',
        message:
          'Xin chào, mình quan tâm căn hộ này, cho mình xin thêm hình ảnh và lịch xem nhà.',
        status: LeadStatus.CONTACTED,
      },
    });
  }

  console.log('Seeded lead demo');

  // -------------------------------------------------------
  // 15. Seed Conversation + Messages demo
  // -------------------------------------------------------
  let conversation1 = await prisma.conversation.findFirst({
    where: {
      post_id: postApartmentSale.post_id,
      buyerId: normalUser.user_id,
      agentId: agentUser.user_id,
    },
  });

  if (!conversation1) {
    conversation1 = await prisma.conversation.create({
      data: {
        post_id: postApartmentSale.post_id,
        buyerId: normalUser.user_id,
        agentId: agentUser.user_id,
      },
    });
  }

  const existingMessages = await prisma.message.findMany({
    where: { conversation_id: conversation1.conversation_id },
  });

  if (existingMessages.length === 0) {
    await prisma.message.createMany({
      data: [
        {
          conversation_id: conversation1.conversation_id,
          senderId: normalUser.user_id,
          content:
            'Chào anh/chị, mình thấy căn hộ 2PN Quận 1 trên web, còn trống không ạ?',
        },
        {
          conversation_id: conversation1.conversation_id,
          senderId: agentUser.user_id,
          content:
            'Chào bạn, căn hộ vẫn còn nhé. Bạn muốn xem nhà vào khung giờ nào?',
        },
        {
          conversation_id: conversation1.conversation_id,
          senderId: normalUser.user_id,
          content: 'Cuối tuần này buổi sáng có được không ạ?',
        },
      ],
    });
  }

  console.log('Seeded conversation + messages demo');

  // -------------------------------------------------------
  // 16. Seed Appointment demo
  // -------------------------------------------------------
  let appointment1 = await prisma.appointment.findFirst({
    where: {
      post_id: postApartmentSale.post_id,
      buyerId: normalUser.user_id,
      agentId: agentUser.user_id,
    },
  });

  if (!appointment1) {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + 2);
    scheduledAt.setHours(10, 0, 0, 0);

    appointment1 = await prisma.appointment.create({
      data: {
        post_id: postApartmentSale.post_id,
        buyerId: normalUser.user_id,
        agentId: agentUser.user_id,
        scheduledAt,
        location: 'Sảnh tiếp tân tòa nhà căn hộ Quận 1',
        status: AppointmentStatus.SCHEDULED,
        notes: 'Khách lần đầu xem nhà, kiểm tra chỗ đậu xe ô tô.',
      },
    });
  }

  console.log('Seeded appointment demo');

  // -------------------------------------------------------
  // 17. Seed Deposit demo
  // -------------------------------------------------------
  const transactionRef = 'DEMO-DEP-0001';

  let deposit1 = await prisma.deposit.findUnique({
    where: { transactionRef },
  });

  if (!deposit1) {
    deposit1 = await prisma.deposit.create({
      data: {
        post_id: postApartmentSale.post_id,
        buyerId: normalUser.user_id,
        sellerId: adminUser.user_id, // seller/owner (tuỳ nghiệp vụ)
        amount: new Prisma.Decimal('500000000.00'),
        status: DepositStatus.CONFIRMED,
        provider: 'DemoPay',
        transactionRef,
        holdExpiresAt: null,
        paidAt: now,
        confirmedAt: now,
        note: 'Đặt cọc demo 500 triệu cho căn hộ 2PN Quận 1.',
      },
    });
  }

  console.log('Seeded deposit demo');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
