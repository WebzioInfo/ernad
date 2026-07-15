import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database/db';
import { customers, salesOrders, salesOrderItems, salesTransactions, products, productBrands, users, productionStock, salesPayments, auditLogs } from '../../database/schema';
import { eq, desc, asc, and, or, ilike, isNull, like, sql, not, gte, lte } from 'drizzle-orm';
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

  async getCustomerSummary(customerId: string) {
    // 1. Fetch customer details
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer) throw new NotFoundException('Customer not found');

    // 2. Fetch sales orders (active, i.e., non-cancelled)
    const activeOrders = await db.select()
      .from(salesOrders)
      .where(and(eq(salesOrders.customerId, customerId), not(eq(salesOrders.status, 'CANCELLED'))));

    const invoiceSalesCount = activeOrders.length;
    const invoiceSalesAmount = activeOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0);

    // 3. Fetch payments
    const payments = await db.select({ amount: salesPayments.amount, paymentDate: salesPayments.paymentDate })
      .from(salesPayments)
      .innerJoin(salesOrders, eq(salesPayments.orderId, salesOrders.id))
      .where(eq(salesOrders.customerId, customerId));

    const amountReceived = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

    // 4. Fetch returns, damages, and direct dispatches value from salesTransactions
    const transactions = await db.select({
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      unitPrice: salesTransactions.unitPrice,
      salesDate: salesTransactions.salesDate
    })
      .from(salesTransactions)
      .where(eq(salesTransactions.customerId, customerId));

    const salesReturns = transactions.filter(r => r.type === 'RETURN');
    const salesReturnsCount = salesReturns.length;
    const salesReturnsAmount = salesReturns.reduce((sum, r) => sum + (r.quantity * parseFloat(r.unitPrice || '0')), 0);

    const damagedReturns = transactions.filter(r => r.type === 'DAMAGE');
    const damagedReturnsCount = damagedReturns.length;
    const damagedReturnsAmount = damagedReturns.reduce((sum, r) => sum + (r.quantity * parseFloat(r.unitPrice || '0')), 0);

    const dispatches = transactions.filter(r => r.type === 'SALES_DISPATCH');
    const dispatchesCount = dispatches.length;
    const dispatchesAmount = dispatches.reduce((sum, d) => sum + (d.quantity * parseFloat(d.unitPrice || '0')), 0);

    // Combine invoice sales and direct dispatch sales
    const totalSalesCount = invoiceSalesCount + dispatchesCount;
    const totalSalesAmount = invoiceSalesAmount + dispatchesAmount;

    // 5. Total Products Purchased (both in invoices and direct dispatches)
    const items = await db.select({ quantity: salesOrderItems.quantity })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrderItems.orderId, salesOrders.id))
      .where(and(eq(salesOrders.customerId, customerId), not(eq(salesOrders.status, 'CANCELLED'))));

    const invoiceProductsCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const dispatchProductsCount = dispatches.reduce((sum, d) => sum + (d.quantity || 0), 0);
    const totalProductsPurchased = invoiceProductsCount + dispatchProductsCount;

    // 6. Outstanding Balance formula (Sales Orders + Sales Dispatches - Payments - Returns - Damages)
    const openBal = parseFloat(customer.openingBalance || '0');
    const openBalSign = customer.openingBalanceType === 'CREDIT' ? -1 : 1;
    const outstandingBalance = (openBal * openBalSign) + totalSalesAmount - amountReceived - salesReturnsAmount - damagedReturnsAmount;

    // 7. Last dates
    const orderDates = activeOrders.map(o => o.orderDate.getTime());
    const dispatchDates = dispatches.map(d => new Date(d.salesDate).getTime());
    const allPurchaseDates = [...orderDates, ...dispatchDates];
    const lastPurchaseDate = allPurchaseDates.length > 0
      ? new Date(Math.max(...allPurchaseDates))
      : null;

    const lastPaymentDate = payments.length > 0
      ? new Date(Math.max(...payments.map(p => p.paymentDate.getTime())))
      : null;

    // 8. Average Order Value
    const averageOrderValue = totalSalesCount > 0 ? (totalSalesAmount / totalSalesCount) : 0;

    return {
      totalSalesCount,
      totalSalesAmount,
      amountReceived,
      outstandingBalance,
      pendingPayments: outstandingBalance > 0 ? outstandingBalance : 0,
      salesReturnsCount,
      salesReturnsAmount,
      damagedReturnsCount,
      damagedReturnsAmount,
      totalProductsPurchased,
      lastPurchaseDate,
      lastPaymentDate,
      averageOrderValue,
      lifetimeCustomerValue: totalSalesAmount
    };
  }

  async getCustomerLedger(customerId: string, query: { startDate?: string; endDate?: string; type?: string }) {
    const customer = await this.getCustomerById(customerId);

    const ledgerEntries: any[] = [];

    // 1. Initial Opening Balance entry
    const openBal = parseFloat(customer.openingBalance || '0');
    const openBalType = customer.openingBalanceType; // 'DEBIT' or 'CREDIT'
    
    ledgerEntries.push({
      date: customer.createdAt,
      reference: 'OPEN-BAL',
      description: 'Opening Balance',
      debit: openBalType === 'DEBIT' ? openBal : 0,
      credit: openBalType === 'CREDIT' ? openBal : 0,
      status: 'CONFIRMED',
      createdBy: 'System',
      transactionType: 'opening'
    });

    // 2. Fetch sales orders (non-cancelled, non-draft)
    const orders = await db.select({
      id: salesOrders.id,
      orderNumber: salesOrders.orderNumber,
      orderDate: salesOrders.orderDate,
      totalAmount: salesOrders.totalAmount,
      status: salesOrders.status,
      creatorName: users.name
    })
      .from(salesOrders)
      .leftJoin(users, eq(salesOrders.createdBy, users.id))
      .where(and(eq(salesOrders.customerId, customerId), not(eq(salesOrders.status, 'CANCELLED')), not(eq(salesOrders.status, 'DRAFT'))));

    for (const order of orders) {
      ledgerEntries.push({
        date: order.orderDate,
        reference: order.orderNumber,
        description: `Invoice / Sales Order (Status: ${order.status})`,
        debit: parseFloat(order.totalAmount || '0'),
        credit: 0,
        status: order.status,
        createdBy: order.creatorName || 'N/A',
        transactionType: 'sale',
        id: order.id
      });
    }

    // 3. Fetch payments
    const payments = await db.select({
      id: salesPayments.id,
      amount: salesPayments.amount,
      paymentDate: salesPayments.paymentDate,
      paymentMethod: salesPayments.paymentMethod,
      referenceNumber: salesPayments.referenceNumber,
      remarks: salesPayments.remarks,
      orderNumber: salesOrders.orderNumber
    })
      .from(salesPayments)
      .innerJoin(salesOrders, eq(salesPayments.orderId, salesOrders.id))
      .where(eq(salesOrders.customerId, customerId));

    for (const p of payments) {
      ledgerEntries.push({
        date: p.paymentDate,
        reference: p.referenceNumber || p.id.substring(0, 8),
        description: `Payment received via ${p.paymentMethod} (Order Ref: ${p.orderNumber}) ${p.remarks ? `- ${p.remarks}` : ''}`,
        debit: 0,
        credit: parseFloat(p.amount || '0'),
        status: 'CONFIRMED',
        createdBy: 'Accountant',
        transactionType: 'payment',
        id: p.id
      });
    }

    // 4. Fetch returns and damages
    const transactions = await db.select({
      id: salesTransactions.id,
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      unitPrice: salesTransactions.unitPrice,
      salesDate: salesTransactions.salesDate,
      remarks: salesTransactions.remarks,
      productName: products.name,
      brandName: productBrands.name,
      perfName: users.name
    })
      .from(salesTransactions)
      .innerJoin(products, eq(salesTransactions.productId, products.id))
      .innerJoin(productBrands, eq(salesTransactions.brandId, productBrands.id))
      .leftJoin(users, eq(salesTransactions.performedBy, users.id))
      .where(eq(salesTransactions.customerId, customerId));

    for (const tx of transactions) {
      const val = tx.quantity * parseFloat(tx.unitPrice || '0');
      if (tx.type === 'RETURN') {
        ledgerEntries.push({
          date: new Date(tx.salesDate),
          reference: `RET-${tx.id.substring(0, 8).toUpperCase()}`,
          description: `Sales Return: ${tx.productName} (Qty: ${tx.quantity}) ${tx.remarks ? `- ${tx.remarks}` : ''}`,
          debit: 0,
          credit: val,
          status: 'CONFIRMED',
          createdBy: tx.perfName || 'N/A',
          transactionType: 'return',
          id: tx.id,
          productName: tx.productName,
          brandName: tx.brandName,
          quantity: tx.quantity,
          unitPrice: tx.unitPrice,
          remarks: tx.remarks
        });
      } else if (tx.type === 'DAMAGE') {
        ledgerEntries.push({
          date: new Date(tx.salesDate),
          reference: `DAM-${tx.id.substring(0, 8).toUpperCase()}`,
          description: `Damaged Return: ${tx.productName} (Qty: ${tx.quantity}) ${tx.remarks ? `- ${tx.remarks}` : ''}`,
          debit: 0,
          credit: val,
          status: 'CONFIRMED',
          createdBy: tx.perfName || 'N/A',
          transactionType: 'damage',
          id: tx.id,
          productName: tx.productName,
          brandName: tx.brandName,
          quantity: tx.quantity,
          unitPrice: tx.unitPrice,
          remarks: tx.remarks
        });
      } else if (tx.type === 'SALES_DISPATCH') {
        ledgerEntries.push({
          date: new Date(tx.salesDate),
          reference: `DISP-${tx.id.substring(0, 8).toUpperCase()}`,
          description: `Sales Dispatch: ${tx.productName} (Qty: ${tx.quantity}) ${tx.remarks ? `- ${tx.remarks}` : ''}`,
          debit: val,
          credit: 0,
          status: 'CONFIRMED',
          createdBy: tx.perfName || 'N/A',
          transactionType: 'sale',
          id: tx.id,
          productName: tx.productName,
          brandName: tx.brandName,
          quantity: tx.quantity,
          unitPrice: tx.unitPrice,
          remarks: tx.remarks
        });
      }
    }

    // Sort chronologically (oldest first)
    ledgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate Running Balance
    let balance = 0;
    for (const entry of ledgerEntries) {
      if (entry.reference === 'OPEN-BAL') {
        balance = openBalType === 'DEBIT' ? openBal : -openBal;
      } else {
        balance = balance + entry.debit - entry.credit;
      }
      entry.runningBalance = balance;
    }

    // Filter by type if requested
    let filtered = ledgerEntries;
    if (query.type) {
      const filterType = query.type.toLowerCase();
      filtered = ledgerEntries.filter(e => {
        if (filterType === 'invoice') return e.debit > 0;
        if (filterType === 'payment') return e.credit > 0 && !e.description.includes('Return');
        if (filterType === 'return') return e.description.includes('Return');
        return true;
      });
    }

    // Filter by date range if requested
    if (query.startDate) {
      const start = new Date(query.startDate);
      filtered = filtered.filter(e => e.date.getTime() >= start.getTime());
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(e => e.date.getTime() <= end.getTime());
    }

    return filtered.reverse();
  }

  async getCustomerSalesHistory(customerId: string, query: { page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;

    // 1. Fetch sales orders (invoices)
    const orders = await db.select({
      id: salesOrders.id,
      orderNumber: salesOrders.orderNumber,
      orderDate: salesOrders.orderDate,
      totalAmount: salesOrders.totalAmount,
      taxAmount: salesOrders.taxAmount,
      status: salesOrders.status,
      paymentStatus: salesOrders.paymentStatus,
      remarks: salesOrders.remarks,
      creatorName: users.name
    })
      .from(salesOrders)
      .leftJoin(users, eq(salesOrders.createdBy, users.id))
      .where(eq(salesOrders.customerId, customerId));

    const mappedOrders = await Promise.all(orders.map(async (o) => {
      const items = await db.select({ quantity: salesOrderItems.quantity })
        .from(salesOrderItems)
        .where(eq(salesOrderItems.orderId, o.id));
      
      const itemCount = items.length;
      const quantitySum = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

      const [paySum] = await db.select({ sum: sql`sum(${salesPayments.amount})` })
        .from(salesPayments)
        .where(eq(salesPayments.orderId, o.id));

      const paid = parseFloat((paySum?.sum as string) || '0');
      const due = parseFloat(o.totalAmount || '0') - paid;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate,
        totalAmount: o.totalAmount,
        taxAmount: o.taxAmount || '0.00',
        status: o.status,
        paymentStatus: o.paymentStatus,
        remarks: o.remarks || null,
        creatorName: o.creatorName || 'N/A',
        itemCount,
        quantity: quantitySum,
        paid,
        due: due > 0 ? due : 0
      };
    }));

    // 2. Fetch direct sales dispatches (salesTransactions where type = 'SALES_DISPATCH')
    const dispatches = await db.select({
      id: salesTransactions.id,
      quantity: salesTransactions.quantity,
      unitPrice: salesTransactions.unitPrice,
      salesDate: salesTransactions.salesDate,
      remarks: salesTransactions.remarks,
      productName: products.name,
      brandName: productBrands.name,
      perfName: users.name
    })
      .from(salesTransactions)
      .innerJoin(products, eq(salesTransactions.productId, products.id))
      .innerJoin(productBrands, eq(salesTransactions.brandId, productBrands.id))
      .leftJoin(users, eq(salesTransactions.performedBy, users.id))
      .where(and(eq(salesTransactions.customerId, customerId), eq(salesTransactions.type, 'SALES_DISPATCH')));

    const mappedDispatches = dispatches.map((d) => {
      const totalAmount = d.quantity * parseFloat(d.unitPrice || '0');
      return {
        id: d.id,
        orderNumber: `DISP-${d.id.substring(0, 8).toUpperCase()}`,
        orderDate: new Date(d.salesDate),
        totalAmount: String(totalAmount),
        taxAmount: '0.00',
        status: 'DELIVERED',
        paymentStatus: 'PENDING',
        remarks: d.remarks || null,
        creatorName: d.perfName || 'N/A',
        itemCount: 1,
        quantity: d.quantity,
        paid: 0,
        due: totalAmount,
        brandName: d.brandName,
        productName: d.productName,
        unitPrice: d.unitPrice
      };
    });

    // 3. Combine both lists
    const combined = [...mappedOrders, ...mappedDispatches];

    // 4. Sort by date descending
    combined.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());

    const total = combined.length;
    const data = combined.slice(offset, offset + limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getCustomerPaymentHistory(customerId: string, query: { page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(salesPayments)
      .innerJoin(salesOrders, eq(salesPayments.orderId, salesOrders.id))
      .where(eq(salesOrders.customerId, customerId));
    const total = Number(countResult?.count || 0);

    const payments = await db.select({
      id: salesPayments.id,
      amount: salesPayments.amount,
      paymentDate: salesPayments.paymentDate,
      paymentMethod: salesPayments.paymentMethod,
      referenceNumber: salesPayments.referenceNumber,
      remarks: salesPayments.remarks,
      orderNumber: salesOrders.orderNumber
    })
      .from(salesPayments)
      .innerJoin(salesOrders, eq(salesPayments.orderId, salesOrders.id))
      .where(eq(salesOrders.customerId, customerId))
      .orderBy(desc(salesPayments.paymentDate))
      .limit(limit)
      .offset(offset);

    return {
      data: payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getCustomerReturnsHistory(customerId: string, query: { page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(salesTransactions)
      .where(and(eq(salesTransactions.customerId, customerId), eq(salesTransactions.type, 'RETURN')));
    const total = Number(countResult?.count || 0);

    const returns = await db.select({
      id: salesTransactions.id,
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      unitPrice: salesTransactions.unitPrice,
      salesDate: salesTransactions.salesDate,
      remarks: salesTransactions.remarks,
      productName: products.name,
      brandName: productBrands.name,
      perfName: users.name
    })
      .from(salesTransactions)
      .innerJoin(products, eq(salesTransactions.productId, products.id))
      .innerJoin(productBrands, eq(salesTransactions.brandId, productBrands.id))
      .leftJoin(users, eq(salesTransactions.performedBy, users.id))
      .where(and(eq(salesTransactions.customerId, customerId), eq(salesTransactions.type, 'RETURN')))
      .orderBy(desc(salesTransactions.salesDate))
      .limit(limit)
      .offset(offset);

    const data = returns.map(r => ({
      ...r,
      refundAmount: r.quantity * parseFloat(r.unitPrice || '0')
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getCustomerDamagesHistory(customerId: string, query: { page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.select({ count: sql`count(*)` })
      .from(salesTransactions)
      .where(and(eq(salesTransactions.customerId, customerId), eq(salesTransactions.type, 'DAMAGE')));
    const total = Number(countResult?.count || 0);

    const damages = await db.select({
      id: salesTransactions.id,
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      unitPrice: salesTransactions.unitPrice,
      salesDate: salesTransactions.salesDate,
      remarks: salesTransactions.remarks,
      productName: products.name,
      brandName: productBrands.name,
      perfName: users.name
    })
      .from(salesTransactions)
      .innerJoin(products, eq(salesTransactions.productId, products.id))
      .innerJoin(productBrands, eq(salesTransactions.brandId, productBrands.id))
      .leftJoin(users, eq(salesTransactions.performedBy, users.id))
      .where(and(eq(salesTransactions.customerId, customerId), eq(salesTransactions.type, 'DAMAGE')))
      .orderBy(desc(salesTransactions.salesDate))
      .limit(limit)
      .offset(offset);

    return {
      data: damages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getCustomerActivities(customerId: string) {
    const activities: any[] = [];

    const customer = await this.getCustomerById(customerId);
    const creator = customer.createdBy ? (await db.select({ name: users.name }).from(users).where(eq(users.id, customer.createdBy)).limit(1))[0] : null;

    activities.push({
      date: customer.createdAt,
      user: creator?.name || 'System',
      action: 'CUSTOMER_CREATED',
      description: `Customer account initialized with opening balance ₹${parseFloat(customer.openingBalance || '0').toLocaleString('en-IN')} (${customer.openingBalanceType})`
    });

    const logs = await db.select({
      action: auditLogs.action,
      occurredAt: auditLogs.occurredAt,
      payload: auditLogs.payload,
      userName: users.name
    })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(eq(auditLogs.entityType, 'customers'), eq(auditLogs.entityId, customerId)))
      .orderBy(desc(auditLogs.occurredAt));

    for (const log of logs) {
      if (log.action === 'CUSTOMER_UPDATED') {
        activities.push({
          date: log.occurredAt,
          user: log.userName || 'N/A',
          action: 'CUSTOMER_EDITED',
          description: 'Profile updates saved (General or tax parameters modified)'
        });
      }
    }

    const orders = await db.select({
      orderDate: salesOrders.orderDate,
      orderNumber: salesOrders.orderNumber,
      totalAmount: salesOrders.totalAmount,
      creatorName: users.name
    })
      .from(salesOrders)
      .leftJoin(users, eq(salesOrders.createdBy, users.id))
      .where(eq(salesOrders.customerId, customerId));

    for (const order of orders) {
      activities.push({
        date: order.orderDate,
        user: order.creatorName || 'N/A',
        action: 'SALE_CREATED',
        description: `Invoice ${order.orderNumber} created for amount ₹${parseFloat(order.totalAmount || '0').toLocaleString('en-IN')}`
      });
    }

    const payments = await db.select({
      paymentDate: salesPayments.paymentDate,
      amount: salesPayments.amount,
      paymentMethod: salesPayments.paymentMethod,
      referenceNumber: salesPayments.referenceNumber,
      orderNumber: salesOrders.orderNumber
    })
      .from(salesPayments)
      .innerJoin(salesOrders, eq(salesPayments.orderId, salesOrders.id))
      .where(eq(salesOrders.customerId, customerId));

    for (const p of payments) {
      activities.push({
        date: p.paymentDate,
        user: 'Accountant',
        action: 'PAYMENT_RECEIVED',
        description: `Received payment ₹${parseFloat(p.amount).toLocaleString('en-IN')} via ${p.paymentMethod} (Ref: ${p.referenceNumber || 'N/A'})`
      });
    }

    const returns = await db.select({
      salesDate: salesTransactions.salesDate,
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      productName: products.name,
      perfName: users.name
    })
      .from(salesTransactions)
      .innerJoin(products, eq(salesTransactions.productId, products.id))
      .leftJoin(users, eq(salesTransactions.performedBy, users.id))
      .where(eq(salesTransactions.customerId, customerId));

    for (const r of returns) {
      activities.push({
        date: new Date(r.salesDate),
        user: r.perfName || 'System',
        action: 'RETURN_PROCESSED',
        description: `Processed return of type ${r.type} for product ${r.productName} (Qty: ${r.quantity})`
      });
    }

    activities.sort((a, b) => b.date.getTime() - a.date.getTime());

    return activities;
  }
}
