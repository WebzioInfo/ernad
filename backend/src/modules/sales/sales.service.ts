import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database/db';
import { customers, salesOrders, salesOrderItems, salesTransactions, products, productBrands, users, productionStock } from '../../database/schema';
import { eq, desc, asc, and, or, ilike, isNull, like, sql, not } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  async getCustomers() {
    return await db.select().from(customers).where(isNull(customers.deletedAt)).orderBy(desc(customers.createdAt));
  }

  async getCustomersFiltered(query: {
    search?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;

    const conditions = [isNull(customers.deletedAt)];

    if (query.status) {
      conditions.push(eq(customers.status, query.status.toUpperCase()));
    }
    if (query.type) {
      conditions.push(eq(customers.customerType, query.type.toUpperCase()));
    }

    if (query.search) {
      const searchPattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.code, searchPattern),
          ilike(customers.businessName, searchPattern),
          ilike(customers.phone, searchPattern),
          ilike(customers.gstNumber, searchPattern)
        )
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db.select({ count: sql`count(*)` }).from(customers).where(whereClause);
    const total = Number(countResult?.count || 0);

    // Sorting
    let orderByField = desc(customers.createdAt);
    if (query.sortBy) {
      const field = query.sortBy;
      const order = query.sortOrder === 'asc' ? asc : desc;
      if (field === 'name') orderByField = order(customers.name);
      else if (field === 'code') orderByField = order(customers.code);
      else if (field === 'businessName') orderByField = order(customers.businessName);
      else if (field === 'createdAt') orderByField = order(customers.createdAt);
      else if (field === 'creditLimit') orderByField = order(customers.creditLimit);
      else if (field === 'openingBalance') orderByField = order(customers.openingBalance);
    }

    const data = await db.select()
      .from(customers)
      .where(whereClause)
      .orderBy(orderByField)
      .limit(limit)
      .offset(offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getCustomerById(id: string) {
    const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), isNull(customers.deletedAt))).limit(1);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getOrders() {
    return await db.select().from(salesOrders).orderBy(desc(salesOrders.orderDate));
  }

  async createCustomer(dto: any, userId?: string) {
    const {
      name,
      code,
      businessName,
      customerType,
      gstNumber,
      panNumber,
      phone,
      alternativePhone,
      email,
      address,
      billingAddress,
      shippingAddress,
      state,
      district,
      country,
      pinCode,
      openingBalance,
      openingBalanceType,
      creditLimit,
      paymentTerms,
      status,
      notes,
      companyId,
      branchId,
      tenantId
    } = dto;

    if (!name || String(name).trim().length === 0) {
      throw new BadRequestException('Customer name is required');
    }
    if (!phone || String(phone).trim().length === 0) {
      throw new BadRequestException('Phone number is required');
    }

    const trimmedName = String(name).trim();
    const trimmedPhone = String(phone).trim();
    const trimmedGst = gstNumber ? String(gstNumber).trim().toUpperCase() : null;

    // Check duplicate name
    const [existingName] = await db.select().from(customers)
      .where(and(eq(customers.name, trimmedName), isNull(customers.deletedAt)))
      .limit(1);
    if (existingName) {
      throw new BadRequestException(`Customer with name "${trimmedName}" already exists`);
    }

    // Check duplicate phone
    const [existingPhone] = await db.select().from(customers)
      .where(and(eq(customers.phone, trimmedPhone), isNull(customers.deletedAt)))
      .limit(1);
    if (existingPhone) {
      throw new BadRequestException(`Customer with phone "${trimmedPhone}" already exists`);
    }

    // Check duplicate GST
    if (trimmedGst) {
      const [existingGst] = await db.select().from(customers)
        .where(and(eq(customers.gstNumber, trimmedGst), isNull(customers.deletedAt)))
        .limit(1);
      if (existingGst) {
        throw new BadRequestException(`Customer with GST "${trimmedGst}" already exists`);
      }
    }

    // Generate code if missing
    let finalCode = code ? String(code).trim() : null;
    if (!finalCode) {
      const lastCust = await db.select({ code: customers.code })
        .from(customers)
        .where(like(customers.code, 'CUST-%'))
        .orderBy(desc(customers.code))
        .limit(1);
      
      if (lastCust.length > 0 && lastCust[0].code) {
        const lastNumStr = lastCust[0].code.replace('CUST-', '');
        const lastNum = parseInt(lastNumStr, 10);
        if (!isNaN(lastNum)) {
          finalCode = `CUST-${String(lastNum + 1).padStart(4, '0')}`;
        } else {
          finalCode = `CUST-0001`;
        }
      } else {
        finalCode = `CUST-0001`;
      }
    }

    const [customer] = await db.insert(customers).values({
      name: trimmedName,
      code: finalCode,
      email: email ? String(email).trim() : null,
      phone: trimmedPhone,
      address: address ? String(address).trim() : null,
      creditLimit: creditLimit !== undefined && creditLimit !== null ? String(creditLimit) : '0',
      businessName: businessName ? String(businessName).trim() : null,
      customerType: customerType ? String(customerType).toUpperCase() : 'BUSINESS',
      gstNumber: trimmedGst,
      panNumber: panNumber ? String(panNumber).trim().toUpperCase() : null,
      alternativePhone: alternativePhone ? String(alternativePhone).trim() : null,
      billingAddress: billingAddress ? String(billingAddress).trim() : null,
      shippingAddress: shippingAddress ? String(shippingAddress).trim() : null,
      state: state ? String(state).trim() : null,
      district: district ? String(district).trim() : null,
      country: country ? String(country).trim() : null,
      pinCode: pinCode ? String(pinCode).trim() : null,
      openingBalance: openingBalance !== undefined && openingBalance !== null ? String(openingBalance) : '0',
      openingBalanceType: openingBalanceType ? String(openingBalanceType).toUpperCase() : 'DEBIT',
      paymentTerms: paymentTerms ? String(paymentTerms).trim() : null,
      status: status ? String(status).toUpperCase() : 'ACTIVE',
      notes: notes ? String(notes).trim() : null,
      createdBy: userId,
      companyId: companyId ? String(companyId) : null,
      branchId: branchId ? String(branchId) : null,
      tenantId: tenantId ? String(tenantId) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Log audit action
    await this.auditService.logAction({
      userId,
      action: 'CUSTOMER_CREATED',
      entityType: 'customers',
      entityId: customer.id,
      category: 'SALES',
      payload: {
        customer
      }
    });

    return customer;
  }

  async updateCustomer(id: string, dto: any, userId: string) {
    const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    const {
      name,
      code,
      businessName,
      customerType,
      gstNumber,
      panNumber,
      phone,
      alternativePhone,
      email,
      address,
      billingAddress,
      shippingAddress,
      state,
      district,
      country,
      pinCode,
      openingBalance,
      openingBalanceType,
      creditLimit,
      paymentTerms,
      status,
      notes
    } = dto;

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (trimmedName.length === 0) throw new BadRequestException('Customer name is required');
      const [dup] = await db.select().from(customers)
        .where(and(eq(customers.name, trimmedName), not(eq(customers.id, id)), isNull(customers.deletedAt)))
        .limit(1);
      if (dup) throw new BadRequestException(`Customer with name "${trimmedName}" already exists`);
    }

    if (phone !== undefined && phone !== null) {
      const trimmedPhone = String(phone).trim();
      if (trimmedPhone.length === 0) throw new BadRequestException('Phone number is required');
      const [dup] = await db.select().from(customers)
        .where(and(eq(customers.phone, trimmedPhone), not(eq(customers.id, id)), isNull(customers.deletedAt)))
        .limit(1);
      if (dup) throw new BadRequestException(`Customer with phone "${trimmedPhone}" already exists`);
    }

    if (gstNumber !== undefined && gstNumber !== null) {
      const trimmedGst = String(gstNumber).trim().toUpperCase();
      if (trimmedGst.length > 0) {
        const [dup] = await db.select().from(customers)
          .where(and(eq(customers.gstNumber, trimmedGst), not(eq(customers.id, id)), isNull(customers.deletedAt)))
          .limit(1);
        if (dup) throw new BadRequestException(`Customer with GST "${trimmedGst}" already exists`);
      }
    }

    const updateObj: any = {
      updatedAt: new Date(),
      updatedBy: userId
    };

    if (name !== undefined) updateObj.name = String(name).trim();
    if (code !== undefined) updateObj.code = code ? String(code).trim() : null;
    if (businessName !== undefined) updateObj.businessName = businessName ? String(businessName).trim() : null;
    if (customerType !== undefined) updateObj.customerType = customerType ? String(customerType).toUpperCase() : 'BUSINESS';
    if (gstNumber !== undefined) updateObj.gstNumber = gstNumber ? String(gstNumber).trim().toUpperCase() : null;
    if (panNumber !== undefined) updateObj.panNumber = panNumber ? String(panNumber).trim().toUpperCase() : null;
    if (phone !== undefined) updateObj.phone = phone ? String(phone).trim() : null;
    if (alternativePhone !== undefined) updateObj.alternativePhone = alternativePhone ? String(alternativePhone).trim() : null;
    if (email !== undefined) updateObj.email = email ? String(email).trim() : null;
    if (address !== undefined) updateObj.address = address ? String(address).trim() : null;
    if (billingAddress !== undefined) updateObj.billingAddress = billingAddress ? String(billingAddress).trim() : null;
    if (shippingAddress !== undefined) updateObj.shippingAddress = shippingAddress ? String(shippingAddress).trim() : null;
    if (state !== undefined) updateObj.state = state ? String(state).trim() : null;
    if (district !== undefined) updateObj.district = district ? String(district).trim() : null;
    if (country !== undefined) updateObj.country = country ? String(country).trim() : null;
    if (pinCode !== undefined) updateObj.pinCode = pinCode ? String(pinCode).trim() : null;
    if (openingBalance !== undefined) updateObj.openingBalance = openingBalance !== null ? String(openingBalance) : '0';
    if (openingBalanceType !== undefined) updateObj.openingBalanceType = openingBalanceType ? String(openingBalanceType).toUpperCase() : 'DEBIT';
    if (creditLimit !== undefined) updateObj.creditLimit = creditLimit !== null ? String(creditLimit) : '0';
    if (paymentTerms !== undefined) updateObj.paymentTerms = paymentTerms ? String(paymentTerms).trim() : null;
    if (status !== undefined) updateObj.status = status ? String(status).toUpperCase() : 'ACTIVE';
    if (notes !== undefined) updateObj.notes = notes ? String(notes).trim() : null;

    const [updated] = await db.update(customers).set(updateObj).where(eq(customers.id, id)).returning();

    // Log audit action
    await this.auditService.logAction({
      userId,
      action: 'CUSTOMER_UPDATED',
      entityType: 'customers',
      entityId: id,
      category: 'SALES',
      payload: {
        before: existing,
        after: updated
      }
    });

    return updated;
  }

  async deleteCustomer(id: string, userId: string) {
    const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    await db.update(customers)
      .set({ deletedAt: new Date(), updatedBy: userId })
      .where(eq(customers.id, id));

    // Log audit action
    await this.auditService.logAction({
      userId,
      action: 'CUSTOMER_DELETED',
      entityType: 'customers',
      entityId: id,
      category: 'SALES',
      payload: {
        deletedRecord: existing
      }
    });

    return { success: true };
  }

  async getOrderById(id: string) {
    const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!order) throw new NotFoundException('Sales order not found');

    const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, id));

    return { ...order, items };
  }

  async createOrder(dto: any, userId: string) {
    const [order] = await db.insert(salesOrders).values({
      ...dto,
      createdBy: userId,
    }).returning();
    return order;
  }

  async updateOrderStatus(id: string, status: any) {
    const [order] = await db.update(salesOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(salesOrders.id, id))
      .returning();
    return order;
  }

  // ─── SALES TRANSACTIONS ─────────────────────────────────────────────

  async getSalesTransactions() {
    return await db.select({
      id: salesTransactions.id,
      brandId: salesTransactions.brandId,
      brandName: productBrands.name,
      productId: salesTransactions.productId,
      productName: products.name,
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      performedBy: salesTransactions.performedBy,
      userName: users.name,
      salesDate: salesTransactions.salesDate,
      customerId: salesTransactions.customerId,
      customerName: customers.name,
      unitPrice: salesTransactions.unitPrice,
      remarks: salesTransactions.remarks,
      updatedBy: salesTransactions.updatedBy,
      createdAt: salesTransactions.createdAt,
      updatedAt: salesTransactions.updatedAt,
    })
    .from(salesTransactions)
    .innerJoin(productBrands, eq(salesTransactions.brandId, productBrands.id))
    .innerJoin(products, eq(salesTransactions.productId, products.id))
    .innerJoin(users, eq(salesTransactions.performedBy, users.id))
    .leftJoin(customers, eq(salesTransactions.customerId, customers.id))
    .orderBy(desc(salesTransactions.salesDate), desc(salesTransactions.createdAt));
  }

  async createSalesTransaction(dto: {
    brandId: string;
    productId: string;
    type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE';
    quantity: number;
    salesDate: string;
    customerId?: string;
    unitPrice?: number;
    remarks?: string;
  }, userId: string) {
    const { brandId, productId, type, quantity, salesDate, customerId, unitPrice, remarks } = dto;
    if (!brandId || !productId || !type || quantity <= 0 || !salesDate || isNaN(Date.parse(salesDate)) || !customerId) {
      throw new BadRequestException('Customer selection is required and all other fields must be valid');
    }
    if (unitPrice !== undefined && (isNaN(unitPrice) || unitPrice < 0)) {
      throw new BadRequestException('unitPrice must be a non-negative number');
    }

    return await db.transaction(async (tx) => {
      let runningStock = 0;
      let runningProduced = 0;
      let runningDispatched = 0;

      const existingStock = await tx.select().from(productionStock).where(eq(productionStock.productId, productId)).limit(1);
      const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!customer) {
        throw new BadRequestException('Selected customer does not exist');
      }
      if (existingStock.length > 0) {
        runningStock = Number(existingStock[0].currentStock);
        runningProduced = Number(existingStock[0].totalProduced);
        runningDispatched = Number(existingStock[0].totalDispatched);
        if (type === 'RETURN') runningStock += quantity;
        else if (type === 'SALES_DISPATCH') {
           runningStock -= quantity;
           runningDispatched += quantity;
        }
        else if (type === 'DAMAGE') runningStock -= quantity;
      }

      // 1. Insert transaction record
      const [transaction] = await tx.insert(salesTransactions).values({
        brandId,
        productId,
        type,
        quantity,
        performedBy: userId,
        salesDate,
        customerId: customerId || null,
        unitPrice: unitPrice !== undefined ? String(unitPrice) : '0.00',
        remarks: remarks || null,
        stockBalanceAfter: String(runningStock),
        producedBalanceAfter: String(runningProduced),
        dispatchedBalanceAfter: String(runningDispatched),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // 2. Recalculate inventory in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

      // 3. Log Audit Action
      await this.auditService.logAction({
        userId,
        action: `SALES_${type}`,
        entityType: 'sales_transactions',
        entityId: transaction.id,
        category: 'SALES',
        payload: {
          brandId,
          productId,
          type,
          quantity,
          salesDate,
          customerId,
          unitPrice,
          remarks,
        },
      });

      return transaction;
    });
  }

  async updateSalesTransaction(id: string, dto: {
    brandId: string;
    productId: string;
    type: 'SALES_DISPATCH' | 'RETURN' | 'DAMAGE';
    quantity: number;
    salesDate: string;
    customerId?: string;
    unitPrice?: number;
    remarks?: string;
  }, userId: string) {
    const { brandId, productId, type, quantity, salesDate, customerId, unitPrice, remarks } = dto;
    if (!brandId || !productId || !type || quantity <= 0 || !salesDate || isNaN(Date.parse(salesDate))) {
      throw new BadRequestException('Invalid input parameters or salesDate');
    }
    if (unitPrice !== undefined && (isNaN(unitPrice) || unitPrice < 0)) {
      throw new BadRequestException('unitPrice must be a non-negative number');
    }

    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(salesTransactions).where(eq(salesTransactions.id, id)).for('update');
      if (!existing) {
        throw new NotFoundException('Sales transaction not found');
      }

      const [updated] = await tx.update(salesTransactions)
        .set({
          brandId,
          productId,
          type,
          quantity,
          salesDate,
          customerId: customerId || null,
          unitPrice: unitPrice !== undefined ? String(unitPrice) : '0.00',
          remarks: remarks || null,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(salesTransactions.id, id))
        .returning();

      // Recalculate inventory in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

      // Construct Diff summary for audit logs
      const changes: string[] = [];
      if (existing.quantity !== updated.quantity) {
        changes.push(`Quantity: ${existing.quantity} → ${updated.quantity}`);
      }
      if (existing.salesDate !== updated.salesDate) {
        changes.push(`Sales Date: ${existing.salesDate} → ${updated.salesDate}`);
      }
      if (existing.productId !== updated.productId) {
        changes.push(`Product ID: ${existing.productId} → ${updated.productId}`);
      }
      if (existing.brandId !== updated.brandId) {
        changes.push(`Brand ID: ${existing.brandId} → ${updated.brandId}`);
      }
      if (existing.type !== updated.type) {
        changes.push(`Type: ${existing.type} → ${updated.type}`);
      }
      if (existing.unitPrice !== updated.unitPrice) {
        changes.push(`Unit Price: ${existing.unitPrice} → ${updated.unitPrice}`);
      }
      if (existing.customerId !== updated.customerId) {
        changes.push(`Customer ID: ${existing.customerId || 'None'} → ${updated.customerId || 'None'}`);
      }
      if (existing.remarks !== updated.remarks) {
        changes.push(`Remarks: "${existing.remarks || ''}" → "${updated.remarks || ''}"`);
      }

      // Log Audit Action
      await this.auditService.logAction({
        userId,
        action: 'SALES_ENTRY_UPDATED',
        entityType: 'sales_transactions',
        entityId: id,
        category: 'SALES',
        payload: {
          before: existing,
          after: updated,
          changes: changes.join(', '),
        },
      });

      return updated;
    });
  }

  async deleteSalesTransaction(id: string, userId: string) {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(salesTransactions).where(eq(salesTransactions.id, id)).for('update');
      if (!existing) {
        throw new NotFoundException('Sales transaction not found');
      }

      await tx.delete(salesTransactions).where(eq(salesTransactions.id, id));

      // Recalculate inventory in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          console.error(`Background recalculateInventory failed:`, err);
        });
      }, 50);

      // Log Audit Action
      await this.auditService.logAction({
        userId,
        action: 'SALES_TRANSACTION_DELETE',
        entityType: 'sales_transactions',
        entityId: id,
        category: 'SALES',
        payload: {
          deletedRecord: existing,
        },
      });

      return { success: true };
    });
  }
}
