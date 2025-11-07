import { describe, it, expect, beforeEach } from 'vitest';
import { EntityManager } from '../src/Entity';

describe('EntityManager', () => {
  let entityManager: EntityManager;

  beforeEach(() => {
    entityManager = new EntityManager();
  });

  describe('create', () => {
    it('should create unique entity IDs', () => {
      const entity1 = entityManager.create();
      const entity2 = entityManager.create();
      const entity3 = entityManager.create();

      expect(entity1).toBe(1);
      expect(entity2).toBe(2);
      expect(entity3).toBe(3);
    });

    it('should create metadata for new entities', () => {
      const entity = entityManager.create();
      const metadata = entityManager.getMetadata(entity);

      expect(metadata).toBeDefined();
      expect(metadata!.generation).toBe(0);
      expect(metadata!.archetype).toBeNull();
      expect(metadata!.archetypeIndex).toBe(-1);
    });
  });

  describe('destroy', () => {
    it('should mark entity as not existing', () => {
      const entity = entityManager.create();
      expect(entityManager.exists(entity)).toBe(true);

      entityManager.destroy(entity);
      expect(entityManager.exists(entity)).toBe(false);
    });

    it('should recycle entity IDs', () => {
      const entity1 = entityManager.create();
      entityManager.destroy(entity1);

      const entity2 = entityManager.create();
      expect(entity2).toBe(entity1); // Same ID recycled
    });

    it('should increment generation on recycle', () => {
      const entity1 = entityManager.create();
      const metadata1 = entityManager.getMetadata(entity1);
      expect(metadata1!.generation).toBe(0);

      entityManager.destroy(entity1);

      const entity2 = entityManager.create();
      const metadata2 = entityManager.getMetadata(entity2);
      expect(entity2).toBe(entity1); // Same ID
      expect(metadata2!.generation).toBe(1); // Incremented generation
    });

    it('should handle destroying non-existent entities gracefully', () => {
      expect(() => entityManager.destroy(999)).not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing entities', () => {
      const entity = entityManager.create();
      expect(entityManager.exists(entity)).toBe(true);
    });

    it('should return false for destroyed entities', () => {
      const entity = entityManager.create();
      entityManager.destroy(entity);
      expect(entityManager.exists(entity)).toBe(false);
    });

    it('should return false for never-created entities', () => {
      expect(entityManager.exists(999)).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for existing entities', () => {
      const entity = entityManager.create();
      const metadata = entityManager.getMetadata(entity);

      expect(metadata).toBeDefined();
      expect(metadata!.generation).toBe(0);
    });

    it('should return undefined for non-existent entities', () => {
      const metadata = entityManager.getMetadata(999);
      expect(metadata).toBeUndefined();
    });

    it('should return undefined for destroyed entities', () => {
      const entity = entityManager.create();
      entityManager.destroy(entity);

      const metadata = entityManager.getMetadata(entity);
      expect(metadata).toBeUndefined();
    });
  });

  describe('setMetadata', () => {
    it('should update entity metadata', () => {
      const entity = entityManager.create();
      const metadata = entityManager.getMetadata(entity)!;

      metadata.archetypeIndex = 5;
      entityManager.setMetadata(entity, metadata);

      const updatedMetadata = entityManager.getMetadata(entity);
      expect(updatedMetadata!.archetypeIndex).toBe(5);
    });
  });

  describe('clear', () => {
    it('should remove all entities', () => {
      const entity1 = entityManager.create();
      const entity2 = entityManager.create();
      const entity3 = entityManager.create();

      expect(entityManager.exists(entity1)).toBe(true);
      expect(entityManager.exists(entity2)).toBe(true);
      expect(entityManager.exists(entity3)).toBe(true);

      entityManager.clear();

      expect(entityManager.exists(entity1)).toBe(false);
      expect(entityManager.exists(entity2)).toBe(false);
      expect(entityManager.exists(entity3)).toBe(false);
    });

    it('should reset ID counter', () => {
      entityManager.create();
      entityManager.create();
      entityManager.clear();

      const newEntity = entityManager.create();
      expect(newEntity).toBe(1);
    });

    it('should clear recycled IDs', () => {
      const entity = entityManager.create();
      entityManager.destroy(entity);
      entityManager.clear();

      const newEntity = entityManager.create();
      expect(newEntity).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const entity1 = entityManager.create();
      const entity2 = entityManager.create();
      entityManager.destroy(entity1);

      const stats = entityManager.getStats();

      expect(stats.active).toBe(1); // Only entity2 exists
      expect(stats.recycled).toBe(1); // entity1 is recycled
    });
  });

  describe('stress test', () => {
    it('should handle creating and destroying many entities', () => {
      const entities: number[] = [];

      // Create 1000 entities
      for (let i = 0; i < 1000; i++) {
        entities.push(entityManager.create());
      }

      expect(entities.length).toBe(1000);
      expect(entityManager.getStats().active).toBe(1000);

      // Destroy half
      for (let i = 0; i < 500; i++) {
        entityManager.destroy(entities[i]);
      }

      expect(entityManager.getStats().active).toBe(500);
      expect(entityManager.getStats().recycled).toBe(500);

      // Create 500 more (should reuse recycled IDs)
      for (let i = 0; i < 500; i++) {
        entityManager.create();
      }

      expect(entityManager.getStats().active).toBe(1000);
      expect(entityManager.getStats().recycled).toBe(0);
    });
  });
});
