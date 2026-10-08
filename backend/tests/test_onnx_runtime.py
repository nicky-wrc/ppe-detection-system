import sys
from types import SimpleNamespace

import numpy as np
import pytest

from app.ml.onnx_runtime import OnnxModel, decode_predictions, letterbox


def test_letterbox_rgb_and_padding():
    frame = np.zeros((100, 200, 3), dtype=np.uint8)
    frame[:, :, 2] = 255
    tensor, ratio, padding = letterbox(frame, 320)
    assert tensor.shape == (1, 3, 320, 320)
    assert tensor.dtype == np.float32 and tensor.flags.c_contiguous
    assert ratio == 1.6 and padding == (0, 80)
    assert tensor[0, 0, 100, 100] == 1
    assert tensor[0, 2, 100, 100] == 0
    assert tensor[0, 0, 0, 0] == pytest.approx(114 / 255)


def test_decode_class_aware_nms_inverse_padding_and_filter():
    # Identical boxes: lower same-class score removed, other class retained.
    output = np.array([[[160, 160, 160], [160, 160, 160], [80, 80, 80],
                        [80, 80, 80], [.9, .8, .1], [.1, .1, .9]]], dtype=np.float32)
    boxes = decode_predictions(output, 2, .2, .45, None, 1.6, (0, 80), (100, 200))
    assert len(boxes) == 2
    assert sorted(int(b.cls[0]) for b in boxes) == [0, 1]
    assert boxes[0].xyxy[0].tolist() == pytest.approx([75, 25, 125, 75])
    filtered = decode_predictions(output, 2, .2, .45, [1], 1.6, (0, 80), (100, 200))
    assert len(filtered) == 1 and int(filtered[0].cls[0]) == 1
    assert len(decode_predictions(output, 2, .2, .45, None, 1, (0, 0), (320, 320), 1)) == 1


def test_empty_invalid_and_nonfinite_outputs():
    assert decode_predictions(np.zeros((1, 6, 3)), 2, .2, .45, None, 1, (0, 0), (320, 320)) == []
    with pytest.raises(ValueError):
        decode_predictions(np.zeros((1, 3, 6)), 2, .2, .45, None, 1, (0, 0), (320, 320))
    output = np.ones((1, 6, 1))
    output[0, 0, 0] = np.nan
    assert decode_predictions(output, 2, .2, .45, None, 1, (0, 0), (320, 320)) == []


def test_session_is_bounded_cpu_only_and_refuses_augmented_inference(monkeypatch):
    class Session:
        def __init__(self, path, sess_options, providers):
            assert providers == ['CPUExecutionProvider']
            assert sess_options.intra_op_num_threads == 1
            assert sess_options.enable_cpu_mem_arena is False
        def get_inputs(self):
            return [SimpleNamespace(type='tensor(float)', shape=[1, 3, 320, 320], name='images')]
        def get_outputs(self):
            return [SimpleNamespace(shape=[1, 6, 2100], name='output0')]
        def get_modelmeta(self):
            return SimpleNamespace(custom_metadata_map={'task':'detect', 'names':"{0: 'person', 1: 'helmet'}"})
        def run(self, names, inputs):
            return [np.zeros((1, 6, 2100), dtype=np.float32)]
    monkeypatch.setitem(sys.modules, 'onnxruntime', SimpleNamespace(
        SessionOptions=SimpleNamespace, InferenceSession=Session,
        GraphOptimizationLevel=SimpleNamespace(ORT_ENABLE_BASIC=1)))
    model = OnnxModel('test.onnx')
    assert model.predict(np.zeros((100, 200, 3), dtype=np.uint8), .2, .45, 320, 'cpu')[0].boxes == []
    with pytest.raises(ValueError):
        model.predict(np.zeros((100, 200, 3), dtype=np.uint8), .2, .45, 320, 'cpu', augment=True)


@pytest.mark.parametrize('change', [
    {'INFERENCE_DEVICE': 'auto'}, {'PPE_CROP_REFINEMENT': True},
    {'MODEL_PATH': './ppe.pt'}, {'INFERENCE_IMAGE_SIZE': 480},
])
def test_onnx_config_fails_closed(change):
    from app.core.config import Settings
    options = dict(_env_file=None, ENVIRONMENT='test', CLOUD_BROWSER_RECORDING=False,
                   INFERENCE_BACKEND='onnx', INFERENCE_DEVICE='cpu',
                   PPE_CROP_REFINEMENT=False, INFERENCE_IMAGE_SIZE=320,
                   MODEL_PATH='./ppe.onnx', PERSON_MODEL_PATH='./person.onnx')
    assert Settings(**options).INFERENCE_BACKEND == 'onnx'
    options.update(change)
    with pytest.raises(ValueError):
        Settings(**options)
