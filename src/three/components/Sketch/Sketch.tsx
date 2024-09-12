import {
  Environment,
  OrbitControls,
  Sky,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { useInteractStore, useLoadedStore } from "@utils/Store";
import { useEffect, useMemo, useRef } from "react";
import {
  BackSide,
  Color,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Uniform,
  Vector2,
  Vector3,
} from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import vertexShader from "../shader/vertex.glsl";
import FacefragmentShader from "../shader/face/fragment.glsl";
import OtherfragmentShader from "../shader/body/fragment.glsl";
import outlineVertexShader from "../shader/outline/vertex.glsl";
import outlineFragmentShader from "../shader/outline/fragment.glsl";
import { useFrame, useThree } from "@react-three/fiber";
import { useControls } from "leva";
import { EffectComposer, SMAA } from "@react-three/postprocessing";
import GTToneMap from "../effect/GTToneMap";
import { Bloom as CustomBloom } from "../effect/Bloom";
import { useDepthTexture } from "@utils/useDepthTexture";
import { SMAAPreset } from "postprocessing";

const Sketch = () => {
  const ayakaGltf = useGLTF("/ayaka.glb");
  const faceLightMap = useTexture("/Face/faceLightmap.png");
  // faceLightMap.wrapS = faceLightMap.wrapT = RepeatWrapping;
  faceLightMap.generateMipmaps = false;
  faceLightMap.flipY = false;
  const hairLightMap = useTexture("/Hair/light.png");
  hairLightMap.flipY = false;
  hairLightMap.wrapS = hairLightMap.wrapT = RepeatWrapping;
  const bodyLightMap = useTexture("/Body/light.png");
  bodyLightMap.flipY = false;
  bodyLightMap.wrapS = bodyLightMap.wrapT = RepeatWrapping;
  const hairRampMap = useTexture("/Hair/ramp.png");
  hairRampMap.generateMipmaps = false;
  hairRampMap.colorSpace = LinearSRGBColorSpace;

  const bodyEmissiveMap = useTexture("/Body/emissive.png");
  bodyEmissiveMap.flipY = false;
  bodyEmissiveMap.colorSpace = SRGBColorSpace;

  const bodyRampMap = useTexture("/Body/ramp.png");
  bodyRampMap.generateMipmaps = false;

  const metalMap = useTexture("matcap/metalMap.png");

  const hairNormalMap = useTexture("/Hair/normal.png");
  hairNormalMap.wrapS = hairNormalMap.wrapT = RepeatWrapping;
  hairNormalMap.flipY = false;

  const bodyNormalMap = useTexture("/Body/normal.png");
  bodyNormalMap.wrapS = bodyNormalMap.wrapT = RepeatWrapping;
  bodyNormalMap.flipY = false;

  const ayakaRef = useRef<any>(null);
  const groupRef = useRef<Group>(null);
  const LightPosRef = useRef<Vector3>(new Vector3());
  const controlDom = useInteractStore((state) => state.controlDom);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const uniforms = useMemo(
    () => ({
      uLightPosition: new Uniform(new Vector3()),
      uFaceLightMap: new Uniform(faceLightMap),
      uRampVmove: new Uniform(0.5), //白天
      uIsDay: new Uniform(0.5),
      uHair: new Uniform(false),
      uShadowColor: new Uniform(new Color("white")),
      uMetalMap: new Uniform(metalMap),
      uNoMetallic: new Uniform(1),
      uMetallic: new Uniform(0.5),
      uRimLightWidth: new Uniform(1),
      uRimLightIntensity: new Uniform(1),
      uTime: new Uniform(0),
      uNear: new Uniform(camera.near),
      uFar: new Uniform(camera.far),
      uResolution: new Uniform(
        new Vector2(
          innerWidth * devicePixelRatio,
          innerHeight * devicePixelRatio
        )
      ),
    }),
    []
  );

  const outlineUniforms = useMemo(
    () => ({
      uResolution: new Uniform(new Vector2()),
      uOutLineWidth: new Uniform(0.4),
    }),
    []
  );

  useControls(
    "DayOrNight",
    {
      time: {
        value: 1,
        min: -1,
        max: 1,
        step: 0.01,
        onChange: (v) => {
          uniforms.uIsDay.value = v;
        },
      },
    },
    {
      collapsed: true,
    }
  );

  useControls(
    "outLine",
    {
      lineWidth: {
        value: 0.3,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v) => {
          outlineUniforms.uOutLineWidth.value = v;
        },
      },
    },
    {
      collapsed: true,
    }
  );

  const { color, int } = useControls(
    "ambientLight",
    {
      color: {
        // #e5cebe
        value: "#ffffff",
      },
      int: {
        // 。85
        value: 1.1,
        min: 0,
        max: 2,
        step: 0.01,
      },
    },
    {
      collapsed: true,
    }
  );

  const { visible, position } = useControls(
    "Light",
    {
      visible: false,
      position: {
        value: { x: 0, y: 10, z: 10 },
        step: 0.01,
      },
      rotation: {
        value: 5.37,
        min: 0,
        max: Math.PI * 2,
        step: Math.PI / 100,
        onChange: (v) => {
          groupRef.current!.rotation.y = v;
        },
      },
    },
    {
      collapsed: true,
    }
  );

  const {
    intensity,
    radius,
    luminanceThreshold,
    iteration,
    luminanceSmoothing,
    glowColor,
  } = useControls(
    "Bloom",
    {
      intensity: {
        // 1.6
        // 2.32
        value: 3.5,
        min: 0,
        max: 10,
        step: 0.01,
      },
      radius: {
        // 0
        // 5
        value: 4,
        min: -10,
        max: 10,
        step: 0.01,
      },
      luminanceThreshold: {
        value: 0.75,
        min: 0,
        max: 1,
        step: 0.01,
      },
      luminanceSmoothing: {
        value: 0.05,
        min: 0,
        max: 1,
        step: 0.01,
      },
      iteration: {
        value: 3,
        min: 1,
        max: 10,
        step: 1,
      },
      glowColor: {
        // #d8b2b2
        value: "#6b3a3a",
      },
    },
    {
      collapsed: true,
    }
  );

  useControls(
    "Shadow",
    {
      ShadowColor: {
        value: "white",
        onChange: (v) => {
          uniforms.uShadowColor.value = new Color(v);
        },
      },
    },
    {
      collapsed: true,
    }
  );

  useControls(
    "Metal",
    {
      metallic: {
        value: 0.2,
        min: 0,
        max: 10,
        step: 0.01,
        onChange: (v) => {
          uniforms.uMetallic.value = v;
        },
      },
      noMetallic: {
        value: 0.1,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v) => {
          uniforms.uNoMetallic.value = v;
        },
      },
    },
    {
      collapsed: true,
    }
  );

  useControls(
    "RimLight",
    {
      RimLightWidth: {
        // 0.12
        value: 0.2,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v) => {
          uniforms.uRimLightWidth.value = v;
        },
      },
      intensity: {
        // 0.5
        value: 0.9,
        min: 0,
        max: 10,
        step: 0.01,
        onChange: (v) => {
          uniforms.uRimLightIntensity.value = v;
        },
      },
    },
    {
      collapsed: true,
    }
  );

  const gtProps = useControls(
    "ToneMapGT",
    {
      MaxLuminanice: {
        value: 2,
        min: 1,
        max: 100,
        step: 0.01,
      },
      Contrast: {
        value: 1,
        min: 1,
        max: 5,
        step: 0.01,
      },
      LinearSectionStart: {
        value: 0.1,
        min: 0,
        max: 1,
        step: 0.01,
      },
      LinearSectionLength: {
        value: 0.12,
        min: 0,
        max: 0.99,
        step: 0.01,
      },
      BlackTightnessC: {
        value: 1.69,
        min: 1,
        max: 3,
        step: 0.01,
      },
      BlackTightnessB: {
        value: 0.0,
        min: 0,
        max: 1,
        step: 0.25,
      },
      Enabled: true,
    },
    {
      collapsed: true,
    }
  );

  const { preset } = useControls(
    "SMAA",
    {
      preset: {
        value: SMAAPreset.ULTRA,
        options: {
          low: SMAAPreset.LOW,
          medium: SMAAPreset.MEDIUM,
          high: SMAAPreset.HIGH,
          ultra: SMAAPreset.ULTRA,
        },
      },
    },
    {
      collapsed: true,
    }
  );

  const { depthTexture } = useDepthTexture(innerWidth, innerHeight);

  useEffect(() => {
    const backModel = ayakaGltf.scene.clone(true);
    ayakaGltf.scene.traverse((child) => {
      if (child instanceof Mesh) {
        const mat = child.material as MeshStandardMaterial;
        mat.map!.colorSpace = SRGBColorSpace;
        if (mat.name == "face") {
          const newMat = new CustomShaderMaterial({
            baseMaterial: MeshStandardMaterial,
            vertexShader,
            fragmentShader: FacefragmentShader,
            uniforms,
            map: mat.map,
            silent: true,
            transparent: mat.transparent,
            side: mat.side,
            alphaTest: mat.alphaTest,
          });
          child.material = newMat;
          child.material.uniforms.uRampMap = new Uniform(bodyRampMap);
          child.material.uniforms.uForwardVec = new Uniform(
            new Vector3(0, 0, 1)
          );
          child.material.uniforms.uLeftVec = new Uniform(new Vector3(1, 0, 0));
        } else {
          child.material = new CustomShaderMaterial({
            name: mat.name,
            baseMaterial: MeshStandardMaterial,
            color: mat.color,
            transparent: mat.transparent,
            map: mat.map,
            depthWrite: mat.depthWrite,
            depthTest: mat.depthTest,
            side: mat.side,
            silent: true,
            alphaTest: mat.alphaTest,
            uniforms,
            vertexShader,
            fragmentShader: OtherfragmentShader,
          });
          if (mat.name === "hair" || mat.name == "dress") {
            child.material.uniforms.uLightMap = new Uniform(hairLightMap);
            child.material.uniforms.uRampMap = new Uniform(hairRampMap);
            child.material.uniforms.uNormalMap = new Uniform(hairNormalMap);
            child.material.uniforms.uEmissiveMap = new Uniform(null);
          } else if (mat.name == "body") {
            child.material.uniforms.uLightMap = new Uniform(bodyLightMap);
            child.material.uniforms.uRampMap = new Uniform(bodyRampMap);
            child.material.uniforms.uNormalMap = new Uniform(bodyNormalMap);
            child.material.uniforms.uEmissiveMap = new Uniform(bodyEmissiveMap);
          }
        }
        child.material.uniforms.uDepthTexture = new Uniform(depthTexture);
      }
    });
    backModel.traverse((child) => {
      if (child instanceof Mesh) {
        const mat = new CustomShaderMaterial({
          baseMaterial: MeshStandardMaterial,
          uniforms: outlineUniforms,
          vertexShader: outlineVertexShader,
          fragmentShader: outlineFragmentShader,
          side: BackSide,
          vertexColors: true,
          silent: true,
          map: child.material.map,
          transparent: true,
        });
        child.material = mat;
      }
    });
    backModel.position.set(0, -0.7, 0);
    scene.add(backModel);
    useLoadedStore.setState({ ready: true });
  }, []);

  useFrame((state, delta) => {
    delta %= 1;
    const vec = LightPosRef.current;
    groupRef.current?.children[0].getWorldPosition(vec);
    uniforms.uLightPosition.value = vec;
    uniforms.uTime.value += delta;
    outlineUniforms.uResolution.value.set(innerWidth, innerHeight);
  });

  return (
    <>
      <OrbitControls domElement={controlDom} />
      <color attach={"background"} args={["black"]} />
      <ambientLight intensity={int} color={color} />
      <Sky
        sunPosition={[0, 0, -1]}
        distance={50000}
        turbidity={8}
        rayleigh={6}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <primitive
        object={ayakaGltf.scene}
        ref={ayakaRef}
        position={[0, -0.7, 0]}
      />

      <group ref={groupRef} visible={visible}>
        <mesh
          position={[position.x, position.y, position.z]}
          scale={[0.2, 0.2, 0.2]}
        >
          <sphereGeometry></sphereGeometry>
          <meshBasicMaterial color={"hotpink"}></meshBasicMaterial>
        </mesh>
      </group>
      <EffectComposer disableNormalPass enabled={true}>
        <CustomBloom
          intensity={intensity}
          luminanceThreshold={luminanceThreshold}
          luminanceSmoothing={luminanceSmoothing}
          radius={radius}
          iteration={iteration}
          glowColor={glowColor}
        />
        <SMAA preset={preset} />
        <GTToneMap {...gtProps} />
      </EffectComposer>
    </>
  );
};

export default Sketch;
