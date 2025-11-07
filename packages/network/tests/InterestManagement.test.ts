/**
 * Interest Management Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpatialInterestPolicy,
  AlwaysInterestedPolicy,
  GridInterestPolicy
} from '../src/InterestManagement';
import { InterestLevel } from '../src/types';

describe('SpatialInterestPolicy', () => {
  let policy: SpatialInterestPolicy;

  beforeEach(() => {
    policy = new SpatialInterestPolicy({
      interestRadius: 100,
      criticalRadius: 10,
      highRadius: 30,
      mediumRadius: 60
    });
  });

  describe('calculateInterest', () => {
    it('should return CRITICAL for self', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 1);
      expect(interest).toBe(InterestLevel.CRITICAL);
    });

    it('should return CRITICAL for entities within critical radius', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 5, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.CRITICAL);
    });

    it('should return HIGH for entities within high radius', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 20, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.HIGH);
    });

    it('should return MEDIUM for entities within medium radius', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 50, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.MEDIUM);
    });

    it('should return LOW for entities within interest radius', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 80, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.LOW);
    });

    it('should return NONE for entities outside interest radius', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 150, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });

    it('should return NONE for unknown observer', () => {
      policy.updatePosition(2, { x: 0, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });

    it('should return NONE for unknown entity', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });

    it('should calculate 3D distance correctly', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 3, y: 4, z: 0 }); // Distance = 5

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.CRITICAL);
    });

    it('should handle vertical distance', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 0, y: 100, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.LOW); // Distance = 100, within interestRadius
    });
  });

  describe('getInterests', () => {
    it('should return all entities within interest radius', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 10, y: 0, z: 0 });
      policy.updatePosition(3, { x: 50, y: 0, z: 0 });
      policy.updatePosition(4, { x: 200, y: 0, z: 0 });

      const interests = policy.getInterests(1);

      expect(interests).toContain(1); // Self
      expect(interests).toContain(2); // Within critical
      expect(interests).toContain(3); // Within medium
      expect(interests).not.toContain(4); // Outside
    });

    it('should return only self when alone', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });

      const interests = policy.getInterests(1);

      expect(interests.size).toBe(1);
      expect(interests).toContain(1);
    });

    it('should return empty set for unknown observer', () => {
      policy.updatePosition(2, { x: 0, y: 0, z: 0 });

      const interests = policy.getInterests(1);

      expect(interests.size).toBe(0);
    });
  });

  describe('updatePosition', () => {
    it('should update entity position', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 5, y: 0, z: 0 });

      let interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.CRITICAL);

      // Move entity 2 far away
      policy.updatePosition(2, { x: 200, y: 0, z: 0 });

      interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from tracking', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 5, y: 0, z: 0 });

      expect(policy.getEntityCount()).toBe(2);

      policy.removeEntity(2);

      expect(policy.getEntityCount()).toBe(1);

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });
  });

  describe('clear', () => {
    it('should clear all tracked positions', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 5, y: 0, z: 0 });

      policy.clear();

      expect(policy.getEntityCount()).toBe(0);
    });
  });
});

describe('AlwaysInterestedPolicy', () => {
  let policy: AlwaysInterestedPolicy;

  beforeEach(() => {
    policy = new AlwaysInterestedPolicy();
  });

  describe('calculateInterest', () => {
    it('should return CRITICAL for self', () => {
      const interest = policy.calculateInterest(1, 1);
      expect(interest).toBe(InterestLevel.CRITICAL);
    });

    it('should return HIGH for all other entities', () => {
      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.HIGH);
    });
  });

  describe('getInterests', () => {
    it('should return all registered entities', () => {
      policy.addEntity(1);
      policy.addEntity(2);
      policy.addEntity(3);

      const interests = policy.getInterests(1);

      expect(interests.size).toBe(3);
      expect(interests).toContain(1);
      expect(interests).toContain(2);
      expect(interests).toContain(3);
    });

    it('should return empty set when no entities', () => {
      const interests = policy.getInterests(1);
      expect(interests.size).toBe(0);
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from tracking', () => {
      policy.addEntity(1);
      policy.addEntity(2);

      policy.removeEntity(1);

      const interests = policy.getInterests(1);
      expect(interests).not.toContain(1);
      expect(interests).toContain(2);
    });
  });

  describe('clear', () => {
    it('should clear all entities', () => {
      policy.addEntity(1);
      policy.addEntity(2);

      policy.clear();

      const interests = policy.getInterests(1);
      expect(interests.size).toBe(0);
    });
  });
});

describe('GridInterestPolicy', () => {
  let policy: GridInterestPolicy;

  beforeEach(() => {
    policy = new GridInterestPolicy({
      cellSize: 50,
      cellRadius: 2
    });
  });

  describe('calculateInterest', () => {
    it('should return CRITICAL for self', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 1);
      expect(interest).toBe(InterestLevel.CRITICAL);
    });

    it('should return HIGH for entities in same cell', () => {
      policy.updatePosition(1, { x: 10, y: 10, z: 10 });
      policy.updatePosition(2, { x: 20, y: 20, z: 20 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.HIGH);
    });

    it('should return MEDIUM for entities in adjacent cells', () => {
      policy.updatePosition(1, { x: 25, y: 25, z: 25 }); // Cell (0, 0, 0)
      policy.updatePosition(2, { x: 75, y: 25, z: 25 }); // Cell (1, 0, 0)

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.MEDIUM);
    });

    it('should return LOW for entities within cell radius', () => {
      policy.updatePosition(1, { x: 25, y: 25, z: 25 }); // Cell (0, 0, 0)
      policy.updatePosition(2, { x: 125, y: 25, z: 25 }); // Cell (2, 0, 0)

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.LOW);
    });

    it('should return NONE for entities outside cell radius', () => {
      policy.updatePosition(1, { x: 25, y: 25, z: 25 }); // Cell (0, 0, 0)
      policy.updatePosition(2, { x: 225, y: 25, z: 25 }); // Cell (4, 0, 0)

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });

    it('should return NONE for unknown entities', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });

    it('should handle negative coordinates', () => {
      policy.updatePosition(1, { x: -25, y: -25, z: -25 });
      policy.updatePosition(2, { x: -30, y: -30, z: -30 });

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.HIGH); // Same cell
    });

    it('should handle 3D cell distance', () => {
      policy.updatePosition(1, { x: 25, y: 25, z: 25 }); // Cell (0, 0, 0)
      policy.updatePosition(2, { x: 75, y: 75, z: 75 }); // Cell (1, 1, 1)

      const interest = policy.calculateInterest(1, 2);
      // Manhattan distance = |1-0| + |1-0| + |1-0| = 3
      // Should be LOW (within cell radius of 2... wait, 3 > 2)
      expect(interest).toBe(InterestLevel.NONE);
    });
  });

  describe('getInterests', () => {
    it('should return entities within cell radius', () => {
      policy.updatePosition(1, { x: 25, y: 25, z: 25 }); // Cell (0, 0, 0)
      policy.updatePosition(2, { x: 30, y: 30, z: 30 }); // Cell (0, 0, 0)
      policy.updatePosition(3, { x: 75, y: 25, z: 25 }); // Cell (1, 0, 0)
      policy.updatePosition(4, { x: 500, y: 500, z: 500 }); // Cell (10, 10, 10)

      const interests = policy.getInterests(1);

      expect(interests).toContain(1); // Self
      expect(interests).toContain(2); // Same cell
      expect(interests).toContain(3); // Adjacent cell
      expect(interests).not.toContain(4); // Far away
    });
  });

  describe('updatePosition', () => {
    it('should update entity cell', () => {
      policy.updatePosition(1, { x: 25, y: 25, z: 25 });
      policy.updatePosition(2, { x: 30, y: 30, z: 30 });

      let interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.HIGH);

      // Move entity 2 far away
      policy.updatePosition(2, { x: 500, y: 500, z: 500 });

      interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from tracking', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 10, y: 10, z: 10 });

      policy.removeEntity(2);

      const interest = policy.calculateInterest(1, 2);
      expect(interest).toBe(InterestLevel.NONE);
    });
  });

  describe('clear', () => {
    it('should clear all tracked entities', () => {
      policy.updatePosition(1, { x: 0, y: 0, z: 0 });
      policy.updatePosition(2, { x: 10, y: 10, z: 10 });

      policy.clear();

      const interests = policy.getInterests(1);
      expect(interests.size).toBe(0);
    });
  });
});

describe('Interest Management Integration', () => {
  it('should efficiently filter entities with spatial policy', () => {
    const policy = new SpatialInterestPolicy({
      interestRadius: 100
    });

    // Create 100 entities in a grid
    for (let i = 0; i < 100; i++) {
      const x = (i % 10) * 50;
      const y = Math.floor(i / 10) * 50;
      policy.updatePosition(i, { x, y, z: 0 });
    }

    // Observer at origin should only see nearby entities
    const interests = policy.getInterests(0);

    // Should have much fewer than 100 entities
    expect(interests.size).toBeLessThan(20);
    expect(interests.size).toBeGreaterThan(0);
  });

  it('should be more efficient with grid policy for large worlds', () => {
    const policy = new GridInterestPolicy({
      cellSize: 100,
      cellRadius: 1
    });

    // Create 1000 entities spread across world
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 10000 - 5000;
      const y = Math.random() * 10000 - 5000;
      const z = Math.random() * 1000 - 500;
      policy.updatePosition(i, { x, y, z });
    }

    // Observer should only see nearby entities
    policy.updatePosition(999, { x: 0, y: 0, z: 0 });
    const interests = policy.getInterests(999);

    // Should filter out most entities
    expect(interests.size).toBeLessThan(100);
  });
});
