/**
 * Test de validación CRUD contra Firestore (offline-first).
 * Ejecutar desde la consola del navegador o como script de prueba.
 *
 * Usa:
 *   import { runValidationTest } from '../tests/firestoreValidation.test';
 *   runValidationTest();
 */

import {
  collection, query, where, getDocs, doc,
  setDoc, updateDoc, deleteDoc, getDoc, writeBatch
} from 'firebase/firestore';
import { db as firestoreDb, auth } from '../lib/firebase';
import { getDb } from '../lib/sync/store';
import { writeWithOfflineQueue } from '../services/firestoreService';
import { SyncEngine } from '../lib/sync/SyncEngine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertDefined(value: any, message: string) {
  assert(value !== null && value !== undefined, message);
}

async function cleanupTest(userId: string) {
  const testIds = [
    'test_doc_read_write',
    'test_doc_update',
    'test_doc_batch_write',
    'test_doc_delete',
  ];
  const batch = writeBatch(firestoreDb);
  for (const id of testIds) {
    batch.delete(doc(firestoreDb, 'tests', id));
  }
  try { await batch.commit(); } catch (e) { /* ignore */ }

  // Also clean local cache
  const localDb = getDb();
  try {
    const keys = await localDb.localCache
      .where(['entity', 'id'])
      .equals(['tests', 'test_doc_read_write'])
      .primaryKeys();
    for (const k of keys) await localDb.localCache.delete(k);
  } catch { /* ignore */ }
}

/**
 * Test 1: Escritura y lectura inmediata en Firestore
 */
async function testWriteAndRead(userId: string) {
  console.log('\n--- Test 1: Write & Read ---');

  const testData = {
    _test: true,
    _testUserId: userId,
    name: 'Test Document',
    value: 42,
    tags: ['a', 'b', 'c'],
    createdAt: new Date().toISOString(),
  };

  // Escritura directa
  await setDoc(doc(firestoreDb, 'tests', 'test_doc_read_write'), testData);

  const snap = await getDoc(doc(firestoreDb, 'tests', 'test_doc_read_write'));
  assert(snap.exists(), 'Document should exist after write');

  const data = snap.data();
  assertEqual(data.name, 'Test Document', 'name field should match');
  assertEqual(data.value, 42, 'value field should match');
  assertEqual(data.tags, ['a', 'b', 'c'], 'tags array should match');

  // Verificar que aparece en la consulta
  const q = query(
    collection(firestoreDb, 'tests'),
    where('_testUserId', '==', userId),
    where('name', '==', 'Test Document')
  );
  const querySnap = await getDocs(q);
  assert(querySnap.size >= 1, 'Query should return the written document');

  console.log('--- Test 1 completado ---\n');
}

/**
 * Test 2: Modificación (update) de un documento
 */
async function testUpdate(userId: string) {
  console.log('\n--- Test 2: Update ---');

  const updatedAt = new Date().toISOString();
  await updateDoc(doc(firestoreDb, 'tests', 'test_doc_read_write'), {
    name: 'Updated Test Document',
    value: 100,
    updatedAt,
  });

  const snap = await getDoc(doc(firestoreDb, 'tests', 'test_doc_read_write'));
  assert(snap.exists(), 'Document should still exist after update');

  const data = snap.data();
  assertEqual(data.name, 'Updated Test Document', 'name should be updated');
  assertEqual(data.value, 100, 'value should be updated');
  assertDefined(data.updatedAt, 'updatedAt should exist');

  console.log('--- Test 2 completado ---\n');
}

/**
 * Test 3: Escritura por lotes (batch write)
 */
async function testBatchWrite(userId: string) {
  console.log('\n--- Test 3: Batch Write ---');

  const batch = writeBatch(firestoreDb);
  const refs = ['test_doc_batch_1', 'test_doc_batch_2', 'test_doc_batch_3'];

  for (const id of refs) {
    batch.set(doc(firestoreDb, 'tests', id), {
      _test: true,
      _testUserId: userId,
      name: `Batch Doc ${id}`,
      order: refs.indexOf(id),
    });
  }

  await batch.commit();

  // Verificar que todos existen
  const q = query(
    collection(firestoreDb, 'tests'),
    where('_testUserId', '==', userId)
  );
  const snap = await getDocs(q);
  assert(snap.size >= 3, `Batch should have created 3+ docs, found ${snap.size}`);

  console.log('--- Test 3 completado ---\n');
}

/**
 * Test 4: Escritura offline con writeWithOfflineQueue
 */
async function testOfflineWrite(userId: string) {
  console.log('\n--- Test 4: Offline Write Queue ---');

  const testData = {
    _test: true,
    _testUserId: userId,
    name: 'Offline Test Document',
    value: 999,
    offlineTest: true,
  };

  await writeWithOfflineQueue('tests', 'test_doc_offline', testData, 'create');

  // Verificar en caché local (Dexie)
  const localDb = getDb();
  const cached = await localDb.localCache
    .where(['entity', 'id'])
    .equals(['tests', 'test_doc_offline'])
    .first();

  assertDefined(cached, 'Document should be in local cache after offline write');

  console.log('--- Test 4 completado ---\n');
}

/**
 * Test 5: Eliminación de documento
 */
async function testDelete(userId: string) {
  console.log('\n--- Test 5: Delete ---');

  // Crear uno para eliminar
  await setDoc(doc(firestoreDb, 'tests', 'test_doc_delete'), {
    _test: true,
    _testUserId: userId,
    name: 'To Be Deleted',
  });

  let snap = await getDoc(doc(firestoreDb, 'tests', 'test_doc_delete'));
  assert(snap.exists(), 'Document should exist before delete');

  await deleteDoc(doc(firestoreDb, 'tests', 'test_doc_delete'));

  snap = await getDoc(doc(firestoreDb, 'tests', 'test_doc_delete'));
  assert(!snap.exists(), 'Document should not exist after delete');

  console.log('--- Test 5 completado ---\n');
}

/**
 * Test 6: Resolver conflictos (optimistic write + sync engine)
 */
async function testSyncEngineEnqueue(userId: string) {
  console.log('\n--- Test 6: SyncEngine Enqueue ---');

  const engine = SyncEngine.getInstance();
  await engine.enqueue('tests', 'create', 'test_doc_sync_enqueue', {
    _test: true,
    _testUserId: userId,
    name: 'Sync Engine Test',
    value: 777,
  });

  // Verificar en cache local
  const localDb = getDb();
  const cached = await localDb.localCache
    .where(['entity', 'id'])
    .equals(['tests', 'test_doc_sync_enqueue'])
    .first();

  assertDefined(cached, 'Document should be in local cache after enqueue');
  assertEqual(cached.name, 'Sync Engine Test', 'name should match');

  console.log('--- Test 6 completado ---\n');
}

/**
 * Test 7: Verificar que no arroja errores de conexión cuando está offline
 */
async function testOfflineStability() {
  console.log('\n--- Test 7: Offline Stability ---');

  // Simular que está offline (navigator.onLine)
  // Si estamos realmente offline, verificar que no explota
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

  if (!isOnline) {
    console.log('Sistema offline detectado - verificando estabilidad...');
    // Intentar leer sin error crítico
    try {
      const localDb = getDb();
      await localDb.localCache.toArray();
      console.log('✅ PASS: Dexie local cache funciona offline');
    } catch (e) {
      console.error('❌ FAIL: Error leyendo cache local:', e);
      failed++;
    }
  } else {
    console.log('⚠️  Sistema online - test de estabilidad offline omitido');
  }

  console.log('--- Test 7 completado ---\n');
}

/**
 * Ejecutar todos los tests de validación
 */
export async function runValidationTest(): Promise<{ passed: number; failed: number }> {
  console.log('========================================');
  console.log('  FIRESTORE VALIDATION TEST');
  console.log('========================================');

  const user = auth.currentUser;
  if (!user) {
    console.error('❌ No hay usuario autenticado. Ejecutar después de login.');
    return { passed: 0, failed: 1 };
  }

  await cleanupTest(user.uid);

  try {
    await testWriteAndRead(user.uid);
    await testUpdate(user.uid);
    await testBatchWrite(user.uid);
    await testWriteAndRead(user.uid); // Releer después de batch
    await testOfflineWrite(user.uid);
    await testDelete(user.uid);
    await testSyncEngineEnqueue(user.uid);
    await testOfflineStability();
  } catch (e: any) {
    console.error('Test crashed:', e);
    failed++;
  }

  // Resumen
  console.log('\n========================================');
  console.log(`  RESULTADOS: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (failed > 0) {
    console.warn('⚠️  Algunos tests fallaron. Revisar logs arriba.');
  } else {
    console.log('🎉 Todos los tests pasaron correctamente.');
  }

  // Cleanup
  await cleanupTest(user.uid);

  return { passed, failed };
}

export { assertEqual, assertDefined };