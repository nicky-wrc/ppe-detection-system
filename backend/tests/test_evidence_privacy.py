import numpy as np

from app.services.evidence_recorder import blur_person_heads


def test_blur_person_heads_only_changes_upper_region():
    rng = np.random.default_rng(42)
    image = rng.integers(0, 255, size=(200, 100, 3), dtype=np.uint8)
    person = {"bbox": [10, 10, 90, 190]}
    blurred = blur_person_heads(image, [person])

    assert not np.array_equal(blurred[10:60, 10:90], image[10:60, 10:90])
    assert np.array_equal(blurred[100:190, 10:90], image[100:190, 10:90])
