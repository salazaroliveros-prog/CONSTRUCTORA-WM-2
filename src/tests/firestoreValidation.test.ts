/**
 * Test de validación CRUD contra Firestore (100% online).
 * Ejecutar desde la consola del navegador:
 *   import { runValidationTest } from '../tests/firestoreValidation.test';
 *   runValidationTest();
 */

import {
  collection, query, where, getDocs, doc,
  setDoc, updateDoc, deleteDoc, getDoc, writeBatch
} from 'firebase/firestore';
import { db as firestoreDb, auth } from '../lib/firebase';

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
}

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

  await setDoc(doc(firestoreDb, 'tests', 'test_doc_read_write'), testData);

  const snap = await getDoc(doc(firestoreDb, 'tests', 'test_doc_read_write'));
  assert(snap.exists(), 'Document should exist after write');

  const data = snap.data();
  assertEqual(data.name, 'Test Document', 'name field should match');
  assertEqual(data.value, 42, 'value field should match');
  assertEqual(data.tags, ['a', 'b', 'c'], 'tags array should match');

  const q = query(
    collection(firestoreDb, 'tests'),
    where('_testUserId', '==', userId),
    where('name', '==', 'Test Document')
  );
  const querySnap = await getDocs(q);
  assert(querySnap.size >= 1, 'Query should return the written document');

  console.log('--- Test 1 completado ---\n');
}

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

  const q = query(
    collection(firestoreDb, 'tests'),
    where('_testUserId', '==', userId)
  );
  const snap = await getDocs(q);
  assert(snap.size >= 3, `Batch should have created 3+ docs, found ${snap.size}`);

  console.log('--- Test 3 completado ---\n');
}

async function testDelete(userId: string) {
  console.log('\n--- Test 4: Delete ---');

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

  console.log('--- Test 4 completado ---\n');
}

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
    await testWriteAndRead(user.uid);
    await testDelete(user.uid);
  } catch (e: any) {
    console.error('Test crashed:', e);
    failed++;
  }

  console.log('\n========================================');
  console.log(`  RESULTADOS: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (failed > 0) {
    console.warn('⚠️  Algunos tests fallaron. Revisar logs arriba.');
  } else {
    console.log('🎉 Todos los tests pasaron correctamente.');
  }

  await cleanupTest(user.uid);

  return { passed, failed };
}

export { assertEqual, assertDefined };
