import { PrismaClient } from '@prisma/client';
import { authService } from '@/services/auth.service';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Create sample tenant
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'acme-corp' },
      update: {},
      create: {
        name: 'Acme Corporation',
        slug: 'acme-corp',
      },
    });

    console.log('✅ Created tenant:', tenant.name);

    // Create admin user
    const adminUser = await authService.createUser({
      email: 'admin@acme-corp.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      tenantId: tenant.id,
      role: 'ADMIN',
    });

    console.log('✅ Created admin user:', adminUser.email);

    // Create regular user
    const regularUser = await authService.createUser({
      email: 'user@acme-corp.com',
      password: 'user123',
      firstName: 'Regular',
      lastName: 'User',
      tenantId: tenant.id,
      role: 'USER',
    });

    console.log('✅ Created regular user:', regularUser.email);

    // Create sample connectors - Only Freshservice (Phase 4 implementation)
    const freshserviceConnector = await prisma.tenantConnector.create({
      data: {
        name: 'Freshservice',
        connectorType: 'FRESHSERVICE',
        config: {
          domain: 'antidote.freshservice.com',
          apiKey: 'Xz4UPeyEbZxdRTitRI2N',
        },
        tenantId: tenant.id,
        status: 'ACTIVE',
      },
    });

    console.log('✅ Created Freshservice connector:', freshserviceConnector.name);

    // Note: ServiceNow and Zendesk connectors removed in Phase 4
    // They will be re-added when their implementations are complete

    // Create sample job (using only Freshservice as both source and destination for demo)
    const sampleJob = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        sourceConnectorId: freshserviceConnector.id,
        destinationConnectorId: freshserviceConnector.id,
        entities: ['tickets', 'users'],
        options: {
          batchSize: 100,
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
          includeAttachments: false,
        },
        status: 'COMPLETED',
        progress: {
          phase: 'completed',
          percentage: 100,
          recordsProcessed: 150,
          totalRecords: 150,
        },
        startedAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T12:30:00Z'),
      },
    });

    console.log('✅ Created sample job');

    // Create sample extracted data
    const extractedData = await prisma.jobExtractedData.create({
      data: {
        jobId: sampleJob.id,
        tenantId: tenant.id,
        entityType: 'tickets',
        batchNumber: 1,
        sourceSystem: 'freshservice',
        rawData: [
          {
            id: 'FS0000001',
            title: 'Email server down',
            description: 'Users cannot access email',
            status: 'resolved',
            priority: 'high',
            createdAt: '2024-01-15T10:00:00Z',
          },
          {
            id: 'FS0000002',
            title: 'Printer not working',
            description: 'Office printer is offline',
            status: 'open',
            priority: 'medium',
            createdAt: '2024-01-16T14:30:00Z',
          },
        ],
        transformedData: [
          {
            id: 'FS0000001',
            title: 'Email server down',
            description: 'Users cannot access email',
            status: 'resolved',
            priority: 'high',
            createdAt: '2024-01-15T10:00:00Z',
            targetId: 'FS-001',
            transformedAt: new Date(),
            targetFormat: 'FRESHSERVICE',
          },
          {
            id: 'FS0000002',
            title: 'Printer not working',
            description: 'Office printer is offline',
            status: 'open',
            priority: 'medium',
            createdAt: '2024-01-16T14:30:00Z',
            targetId: 'FS-002',
            transformedAt: new Date(),
            targetFormat: 'FRESHSERVICE',
          },
        ],
        recordCount: 2,
        extractionTimestamp: new Date('2024-01-15T10:30:00Z'),
        expiresAt: new Date('2024-01-22T10:30:00Z'), // 7 days later
      },
    });

    console.log('✅ Created sample extracted data');

    // Create sample loading results
    await prisma.jobLoadResult.create({
      data: {
        jobExtractedDataId: extractedData.id,
        destinationSystem: 'freshservice',
        successCount: 95,
        failedCount: 5,
        errorDetails: {},
        loadedAt: new Date(),
      },
    });

    console.log('✅ Created sample loading results');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Sample credentials:');
    console.log('Admin: admin@acme-corp.com / admin123');
    console.log('User:  user@acme-corp.com / user123');
    console.log('\n🔗 Tenant: acme-corp');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

export { seed }; 