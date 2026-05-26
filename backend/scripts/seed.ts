import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';

import { db } from '../src/database/db';
import {
  users,
  roles,
  userRoles,
  productionLines,
  shifts,
  productBrands,
  products,
  inventoryStock,
  packagingConfigurations,
  warehouseLocations,
  materialCategories,
  rawMaterials,
} from '../src/database/schema';

async function seed() {
  console.log('🌱 Starting seed...');

  // ── Roles ────────────────────────────────────────────────────────────────
  const roleList = [
    { name: 'Admin', slug: 'admin' },
    { name: 'Manager', slug: 'manager' },
    { name: 'Supervisor', slug: 'supervisor' },
    { name: 'Operator', slug: 'operator' },
    { name: 'QC', slug: 'qc' },
  ];

  for (const role of roleList) {
    const existing = await db
      .select()
      .from(roles)
      .where(eq(roles.slug, role.slug));

    if (!existing.length) {
      await db.insert(roles).values(role);
    }
  }

  const [adminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.slug, 'admin'));

  const [managerRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.slug, 'manager'));

  const [operatorRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.slug, 'operator'));

  // ── Users ─────────────────────────────────────────────────────────────────
  // Schema fields: name, username, email, passwordHash, isActive
  const adminExists = await db
    .select()
    .from(users)
    .where(eq(users.username, 'admin.admin'));

  let adminUserId: string;

  if (!adminExists.length) {
    const hashed = await bcrypt.hash('adminadmin', 10);

    const inserted = await db
      .insert(users)
      .values({
        name: 'System Admin',
        username: 'admin.admin',
        email: 'admin.admin@ernad.local',
        passwordHash: hashed,
        isActive: true,
      })
      .returning();

    adminUserId = inserted[0].id;
  } else {
    adminUserId = adminExists[0].id;
  }

  const hasAdminRole = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, adminUserId), eq(userRoles.roleId, adminRole.id)));

  if (!hasAdminRole.length) {
    await db.insert(userRoles).values({
      userId: adminUserId,
      roleId: adminRole.id,
    });
  }

  const managerExists = await db
    .select()
    .from(users)
    .where(eq(users.username, 'pranesh.manager'));

  if (!managerExists.length) {
    const hashed = await bcrypt.hash('adminadmin', 10);

    const inserted = await db
      .insert(users)
      .values({
        name: 'Pranesh Manager',
        username: 'pranesh.manager',
        email: 'pranesh.manager@ernad.local',
        passwordHash: hashed,
        isActive: true,
      })
      .returning();

    await db.insert(userRoles).values({
      userId: inserted[0].id,
      roleId: managerRole.id,
    });
  }

  const operatorExists = await db
    .select()
    .from(users)
    .where(eq(users.username, 'sujith.blower'));

  const hashed = await bcrypt.hash('1234', 10);

  if (!operatorExists.length) {
    const inserted = await db
      .insert(users)
      .values({
        name: 'Sujith Blower',
        username: 'sujith.blower',
        email: 'sujith.blower@ernad.local',
        passwordHash: hashed,
        pinCode: hashed,
        isActive: true,
      })
      .returning();

    await db.insert(userRoles).values({
      userId: inserted[0].id,
      roleId: operatorRole.id,
    });
  } else {
    await db
      .update(users)
      .set({ pinCode: hashed })
      .where(eq(users.id, operatorExists[0].id));
  }

  const danishExists = await db
    .select()
    .from(users)
    .where(eq(users.username, 'danish.filling'));

  if (!danishExists.length) {
    const inserted = await db
      .insert(users)
      .values({
        name: 'Danish Filling',
        username: 'danish.filling',
        email: 'danish.filling@ernad.local',
        passwordHash: hashed,
        pinCode: hashed,
        isActive: true,
      })
      .returning();

    await db.insert(userRoles).values({
      userId: inserted[0].id,
      roleId: operatorRole.id,
    });
  } else {
    await db
      .update(users)
      .set({ pinCode: hashed })
      .where(eq(users.id, danishExists[0].id));
  }

  // ── Production Lines ──────────────────────────────────────────────────────
  // Schema fields: name, description, status, currentEfficiency (no 'code' or 'isActive')
  const lines = [
    { name: 'Line 1', status: 'IDLE' as const },
    { name: 'Line 2', status: 'IDLE' as const },
  ];

  for (const line of lines) {
    const exists = await db
      .select()
      .from(productionLines)
      .where(eq(productionLines.name, line.name));

    if (!exists.length) {
      await db.insert(productionLines).values(line);
    }
  }

  // ── Shifts ────────────────────────────────────────────────────────────────
  // Schema fields: name, startTime, endTime (no 'isActive')
  const shiftList = [
    { name: 'Morning', startTime: '06:00', endTime: '14:00' },
    { name: 'Evening', startTime: '14:00', endTime: '22:00' },
    { name: 'Night', startTime: '22:00', endTime: '06:00' },
  ];

  for (const shift of shiftList) {
    const exists = await db
      .select()
      .from(shifts)
      .where(eq(shifts.name, shift.name));

    if (!exists.length) {
      await db.insert(shifts).values(shift);
    }
  }

  // ── Brand ─────────────────────────────────────────────────────────────────
  let brand = await db
    .select()
    .from(productBrands)
    .where(eq(productBrands.name, 'Kenby'));

  if (!brand.length) {
    brand = await db
      .insert(productBrands)
      .values({ name: 'Kenby' })
      .returning();
  }

  // ── Products ──────────────────────────────────────────────────────────────
  // Schema fields: name, sku, brandId, category, targetBPM (no 'size' or 'isActive')
  const productList = [
    { name: 'Kenby 250ML', sku: 'KENBY-250', category: 'Water' },
    { name: 'Kenby 500ML', sku: 'KENBY-500', category: 'Water' },
    { name: 'Kenby 1L',    sku: 'KENBY-1000', category: 'Water' },
    { name: 'Kenby 2L',    sku: 'KENBY-2000', category: 'Water' },
    { name: 'Kenby 20L Jar', sku: 'KENBY-20L', category: 'Water' },
  ];

  for (const product of productList) {
    const exists = await db
      .select()
      .from(products)
      .where(eq(products.sku, product.sku));

    if (!exists.length) {
      await db.insert(products).values({
        ...product,
        brandId: brand[0].id,
      });
    }
  }

  // Re-fetch products for packaging config linking
  const kenby500 = await db
    .select()
    .from(products)
    .where(eq(products.sku, 'KENBY-500'));

  // ── Warehouse Location (required FK for inventoryStock) ───────────────────
  let rawWarehouse = await db
    .select()
    .from(warehouseLocations)
    .where(eq(warehouseLocations.name, 'Main Warehouse'));

  if (!rawWarehouse.length) {
    rawWarehouse = await db
      .insert(warehouseLocations)
      .values({ name: 'Main Warehouse', type: 'RAW_MATERIAL' })
      .returning();
  }

  // ── Material Category (optional FK for inventoryStock) ────────────────────
  let rawCategory = await db
    .select()
    .from(materialCategories)
    .where(eq(materialCategories.name, 'Packaging Materials'));

  if (!rawCategory.length) {
    rawCategory = await db
      .insert(materialCategories)
      .values({ name: 'Packaging Materials' })
      .returning();
  }

  // ── Material Categories ──────────────────────────────────────────────────
  const categoriesToSeed = [
    { name: 'Caps', description: 'Plastic closures for bottles' },
    { name: 'Preforms', description: 'PET resin preforms for blowing bottles' },
    { name: 'Labels', description: 'BOPP roll labels or stickers' },
    { name: 'Shrink Rolls', description: 'Shrink wrapping plastic' }
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of categoriesToSeed) {
    let [existing] = await db
      .select()
      .from(materialCategories)
      .where(eq(materialCategories.name, cat.name))
      .limit(1);

    if (!existing) {
      const [inserted] = await db
        .insert(materialCategories)
        .values(cat)
        .returning();
      existing = inserted;
    }
    categoryMap[cat.name] = existing.id;
  }

  // ── Raw Materials ────────────────────────────────────────────────────────
  const rawMaterialsToSeed = [
    { name: 'Cap 1', categoryName: 'Caps' },
    { name: 'Cap 2', categoryName: 'Caps' },
    { name: 'Preform PET Resin A', categoryName: 'Preforms' },
    { name: 'Preform PET Resin B', categoryName: 'Preforms' },
  ];

  for (const mat of rawMaterialsToSeed) {
    const catId = categoryMap[mat.categoryName];
    if (catId) {
      const [existing] = await db
        .select()
        .from(rawMaterials)
        .where(and(
          eq(rawMaterials.name, mat.name),
          eq(rawMaterials.categoryId, catId)
        ))
        .limit(1);

      if (!existing) {
        await db.insert(rawMaterials).values({
          name: mat.name,
          categoryId: catId,
        });
      }
    }
  }

  // ── Inventory Stock ───────────────────────────────────────────────────────
  // Schema fields: warehouseId (NOT NULL), categoryId, itemName, sku, unit, quantity, minimumStock, valuationRate
  const stockItems = [
    { itemName: 'Preform 28g',        sku: 'PREFORM-28',   quantity: '50000', unit: 'PCS' },
    { itemName: 'Blue Cap',            sku: 'CAP-BLUE',     quantity: '100000', unit: 'PCS' },
    { itemName: 'Kenby Label 500ML',   sku: 'LBL-500',      quantity: '50',    unit: 'KG' },
    { itemName: 'Shrink Roll',         sku: 'SHRINK-ROLL',  quantity: '100',   unit: 'KG' },
    { itemName: 'Inkjet Ink',          sku: 'INKJET-INK',   quantity: '20',    unit: 'LTR' },
  ];

  for (const item of stockItems) {
    const exists = await db
      .select()
      .from(inventoryStock)
      .where(eq(inventoryStock.sku, item.sku));

    if (!exists.length) {
      await db.insert(inventoryStock).values({
        ...item,
        warehouseId: rawWarehouse[0].id,
        categoryId: rawCategory[0].id,
      });
    }
  }

  // ── Packaging Configurations ──────────────────────────────────────────────
  // Schema fields: productId (NOT NULL), name, bottlesPerCase, shrinkWeightPerCaseKg (NOT NULL), cartonsPerCase, isActive
  // Link to Kenby 500ML as the representative product
  if (kenby500.length) {
    const packs = [
      { name: '6 Bottle Case',   bottlesPerCase: 6,  shrinkWeightPerCaseKg: '0.0500' },
      { name: '12 Bottle Case',  bottlesPerCase: 12, shrinkWeightPerCaseKg: '0.0900' },
      { name: '24 Bottle Case',  bottlesPerCase: 24, shrinkWeightPerCaseKg: '0.1500' },
      { name: '30 Bottle Case',  bottlesPerCase: 30, shrinkWeightPerCaseKg: '0.1800' },
    ];

    for (const pack of packs) {
      const exists = await db
        .select()
        .from(packagingConfigurations)
        .where(eq(packagingConfigurations.name, pack.name));

      if (!exists.length) {
        await db.insert(packagingConfigurations).values({
          ...pack,
          productId: kenby500[0].id,
          isActive: true,
        });
      }
    }
  }

  console.log('✅ Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});